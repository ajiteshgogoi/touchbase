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
    pattern: /,\s+(and|or)\s+(?:[^,\n]+(,\s+)?)*[^,\n]+$/gm,
    message: (match) => `Remove Oxford comma before "${match.includes('and') ? 'and' : 'or'}"`,
    fix: (text) => {
      // Handle both 'and' and 'or' cases, but only at the end of lists
      return text
        .replace(/,(\s+and\s+(?:[^,\n]+(,\s+)?)*[^,\n]+$)/gm, '$1')
        .replace(/,(\s+or\s+(?:[^,\n]+(,\s+)?)*[^,\n]+$)/gm, '$1');
    }
  },

  // Check for American-style punctuation with quotes
  americanQuotePunctuation: {
    pattern: /["'].+?\.['"]/g,
    message: 'Move full stop outside quotation marks unless part of the quote',
    fix: (text) => {
      return text.replace(/["'](.+?)\.["']/g, (match, content) => {
        // Don't change if the period is part of an abbreviation
        if (content.match(/\b[A-Z]\./)) return match;
        // Don't change if it's a complete sentence
        if (content.match(/^[A-Z].*[.!?]$/)) return match;
        return `"${content}"`.trim() + '.';
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

  // Check each rule
  for (const [ruleName, rule] of Object.entries(rules)) {
    if (ruleName === 'spelling') {
      // Handle spelling patterns
      for (const pattern of rule.patterns) {
        const matches = [...markdown.matchAll(pattern.find)];
        if (matches.length > 0) {
          matches.forEach(match => {
            const line = getLineNumber(markdown, match.index);
            issues.push({
              line,
              message: pattern.message,
              original: match[0],
              suggested: match[0].replace(pattern.find, pattern.replace)
            });
          });
          fixedContent = fixedContent.replace(pattern.find, pattern.replace);
        }
      }
    } else {
      // Handle other rules
      const matches = [...markdown.matchAll(rule.pattern)];
      if (matches.length > 0) {
        matches.forEach(match => {
          const line = getLineNumber(markdown, match.index);
          issues.push({
            line,
            message: rule.message,
            original: match[0],
            suggested: rule.fix(match[0])
          });
        });
        fixedContent = rule.fix(fixedContent);
      }
    }
  }

  return {
    filePath,
    issues,
    fixedContent: issues.length > 0 ? matter.stringify(fixedContent, frontmatter) : null
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
      // Exit with error code 1 to indicate changes were made
      console.log(chalk.yellow('\nContent was fixed. Please commit the changes and run the build again.'));
      process.exit(1);
    } else {
      console.log(chalk.green('\nAll blog posts follow British English conventions!'));
      process.exit(0);
    }

  } catch (error) {
    console.error(chalk.red('Error validating blog posts:', error));
    process.exit(1);
  }
}

if (require.main === module) {
  validateBlogContent();
}

export { validateBlogContent };