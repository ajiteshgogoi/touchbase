import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validation rules
const rules = {
  // Check for Oxford commas (not allowed in British English)
  oxfordComma: {
    // Only match Oxford commas in actual lists, not in other contexts
    pattern: /,(\s+)(and|or)(?=\s+[^,]+(?:\s*[.?!]|$))/g,
    message: (match) => `Remove Oxford comma before "${match.includes('and') ? 'and' : 'or'}"`,
    fix: (text) => text.replace(/,(\s+)(and|or)(?=\s+[^,]+(?:\s*[.?!]|$))/g, '$1$2')
  },

  // Check for American-style punctuation with quotes
  americanQuotePunctuation: {
    pattern: /["']([^.!?"']+)\.["']/g,
    message: 'Move full stop outside quotation marks unless part of the quote',
    fix: (text) => {
      return text.replace(/["']([^.!?"']+)\.["']/g, (match, content) => {
        // Skip markdown links
        if (match.match(/\[.*\]\(.*\)/)) return match;
        
        // Don't modify if it contains ellipsis
        if (match.includes('...')) return match;
        
        // Don't modify markdown formatting
        if (match.match(/[*_`].*[*_`]/)) return match;
        
        // Don't modify if it contains a colon
        if (content.includes(':')) return match;
        
        // Don't modify if it's a technical term, title, or contains special formatting
        if (content.match(/^[A-Z].*:|^\*\*.*\*\*$|^`.*`$|^_.*_$/)) return match;
        
        // Don't change if the period is part of an abbreviation
        if (content.match(/\b[A-Z]\./)) return match;
        
        // Don't change if it's a complete sentence
        if (content.match(/^[A-Z].*[.!?]$/)) return match;

        // If the suggested fix would be identical to the original, return the original
        const suggested = `"${content}"` + '.';
        if (suggested === match) return match;

        return suggested;
      });
    }
  },

  // Additional British English checks
  spelling: {
    patterns: [
      { find: /\b(center|centered)\b/g, replace: 'centre', message: 'Use British spelling: "centre"' },
      { find: /\b(color)\b/g, replace: 'colour', message: 'Use British spelling: "colour"' },
      { find: /\b(flavor)\b/g, replace: 'flavour', message: 'Use British spelling: "flavour"' },
      { find: /\b(defense)\b/g, replace: 'defence', message: 'Use British spelling: "defence"' },
      { find: /\b(analyze)\b/g, replace: 'analyse', message: 'Use British spelling: "analyse"' },
      { find: /\b(organization)\b/g, replace: 'organisation', message: 'Use British spelling: "organisation"' }
    ]
  }
};

async function validateFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const { data: frontmatter, content: markdown } = matter(content);
  const issues = [];
  let fixedContent = markdown;
  const processedLocations = new Set(); // Track processed locations to avoid duplicates

  // Check each rule
  for (const [ruleName, rule] of Object.entries(rules)) {
    if (ruleName === 'spelling') {
      // Handle spelling patterns
      for (const pattern of rule.patterns) {
        const matches = [...markdown.matchAll(pattern.find)];
        if (matches.length > 0) {
          matches.forEach(match => {
            const location = `${match.index}-${match[0].length}`;
            if (!processedLocations.has(location)) {
              processedLocations.add(location);
              const line = getLineNumber(markdown, match.index);
              const context = getContext(markdown, match.index);
              if (!context.isCodeBlock && !context.isYamlFrontmatter) {
                issues.push({
                  line,
                  message: pattern.message,
                  original: match[0],
                  suggested: match[0].replace(pattern.find, pattern.replace)
                });
                fixedContent = fixedContent.replace(pattern.find, pattern.replace);
              }
            }
          });
        }
      }
    } else {
      // Get all matches first
      // Handle other rules
      const matches = [...markdown.matchAll(rule.pattern)];
      if (matches.length > 0) {
        matches.forEach(match => {
          const location = `${match.index}-${match[0].length}`;
          if (!processedLocations.has(location)) {
            processedLocations.add(location);
            const line = getLineNumber(markdown, match.index);
            const context = getContext(markdown, match.index);
            if (!context.isCodeBlock && !context.isYamlFrontmatter) {
              // Skip if it's just a colon followed by space(s)
              if (match[0].match(/^:\s+$/)) {
                return;
              }
              const message = typeof rule.message === 'function' ?
                rule.message(match[0]) : rule.message;
              const suggested = rule.fix(match[0]);
              // Only push if the suggested fix is different from the original
              if (suggested !== match[0]) {
                issues.push({
                  line,
                  message,
                  original: match[0],
                  suggested
                });
              }
            }
          }
        });
        // Only apply fixes if there are valid issues
        if (issues.length > issues.length - matches.length) {
          fixedContent = rule.fix(fixedContent);
        }
      }
    }
  }

  return {
    filePath,
    issues,
    fixedContent: issues.length > 0 ? matter.stringify(fixedContent, frontmatter) : null
  };
}

function getContext(text, index) {
  let currentPos = 0;
  let inCodeBlock = false;
  let inFrontmatter = false;
  let codeBlockMarkers = 0;
  let lineStart = 0;

  // Get the line containing the index
  const lines = text.split('\n');
  for (const [i, line] of lines.entries()) {
    if (currentPos <= index && currentPos + line.length >= index) {
      // Check code block markers
      if (line.trim().startsWith('```')) {
        codeBlockMarkers++;
        inCodeBlock = codeBlockMarkers % 2 !== 0;
      }
      
      // Check frontmatter
      if (i === 0 && line.trim() === '---') {
        inFrontmatter = true;
      } else if (inFrontmatter && line.trim() === '---') {
        inFrontmatter = false;
      }

      // Check for inline code
      if (!inCodeBlock) {
        const lineOffset = index - currentPos;
        const beforeText = line.slice(0, lineOffset);
        const backtickCount = (beforeText.match(/`/g) || []).length;
        if (backtickCount % 2 !== 0) {
          inCodeBlock = true;
        }
      }

      break;
    }
    currentPos += line.length + 1;
  }

  return {
    isCodeBlock: inCodeBlock,
    isYamlFrontmatter: inFrontmatter
  };
}

function getLineNumber(text, index) {
  const lines = text.slice(0, index).split('\n');
  return lines.length;
}

async function validateBlogContent() {
  try {
    const contentDir = path.join(dirname(dirname(__filename)), 'src', 'content', 'blog');
    
    try {
      await fs.access(contentDir);
    } catch (err) {
      console.log(chalk.yellow('No blog directory found at', contentDir));
      return;
    }

    const files = await fs.readdir(contentDir);
    if (files.length === 0) {
      console.log(chalk.yellow('No blog posts found'));
      return;
    }

    const mdFiles = files.filter(file => file.endsWith('.md'));
    let hasIssues = false;
    let fixedFiles = [];

    for (const file of mdFiles) {
      const filePath = path.join(contentDir, file);
      const validation = await validateFile(filePath);

      if (validation.issues.length > 0) {
        hasIssues = true;
        console.log(chalk.yellow(`\nIssues in ${file}:`));
        validation.issues.forEach(issue => {
          console.log(chalk.red(`  Line ${issue.line}: ${issue.message}`));
          console.log(chalk.dim(`    Original: ${issue.original}`));
          console.log(chalk.green(`    Suggested: ${issue.suggested}`));
        });
        fixedFiles.push({
          path: filePath,
          content: validation.fixedContent
        });
      } else {
        console.log(chalk.green(`✓ ${file} - No issues found`));
      }
    }

    if (hasIssues) {
      console.log(chalk.yellow('\nApplying fixes automatically...'));
      for (const file of fixedFiles) {
        await fs.writeFile(file.path, file.content, 'utf-8');
        console.log(chalk.green(`✓ Fixed: ${path.basename(file.path)}`));
      }
      
      console.log(chalk.yellow('\nContent was fixed. Please commit the changes and run the build again.'));
      
      // Only exit if running as main module
      if (import.meta.url === `file://${process.argv[1]}`) {
        process.exit(1);
      } else {
        throw new Error('Content fixes were applied');
      }
    } else {
      console.log(chalk.green('\nAll blog posts follow British English conventions!'));
      // Don't exit when running as a module
      if (import.meta.url === `file://${process.argv[1]}`) {
        process.exit(0);
      }
    }

  } catch (error) {
    console.error(chalk.red('Error validating blog posts:', error));
    process.exit(1);
  }
}

// Run validation if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  validateBlogContent();
}

export { validateBlogContent };