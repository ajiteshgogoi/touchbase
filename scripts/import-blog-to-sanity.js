import { createClient } from '@sanity/client';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import dotenv from 'dotenv';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { validateBlogContent } from './validate-blog-content.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const client = createClient({
  projectId: process.env.VITE_SANITY_PROJECT_ID,
  dataset: process.env.VITE_SANITY_DATASET,
  token: process.env.VITE_SANITY_TOKEN,
  apiVersion: '2024-04-03',
  useCdn: false,
});

function markdownToPortableText(markdown) {
  const html = marked.parse(markdown, { xhtml: true }); // Use XHTML for proper self-closing tags
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const blocks = [];

  const blockElements = document.body.children;
  for (const element of blockElements) {
    const block = processElement(element);
    if (Array.isArray(block)) {
      blocks.push(...block);
    } else if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

function processElement(element) {
  const tagName = element.tagName.toLowerCase();
  
  switch (tagName) {
    case 'p': {
      const img = element.querySelector('img');
      if (img) {
        return createImageBlock(img);
      }
      return createBlock('normal', processChildren(element));
    }
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
      return createBlock(tagName, processChildren(element));
    case 'blockquote':
      return createBlock('blockquote', processChildren(element));
    case 'ul':
      return processListItems(element, 'bullet');
    case 'ol':
      return processListItems(element, 'number');
    case 'pre': {
      const code = element.querySelector('code');
      if (code) {
        const language = code.className.replace('language-', '') || 'text';
        return createCodeBlock(code.textContent, language);
      }
      return createBlock('normal', processChildren(element));
    }
    case 'img':
      return createImageBlock(element);
    case 'div':
      if (element.classList.contains('raw-html')) {
        return createRawHtmlBlock(element.innerHTML);
      }
      // Process div contents as regular blocks
      return Array.from(element.children).map(child => processElement(child)).filter(Boolean);
    default:
      return null;
  }
}

function processChildren(element) {
  const children = [];
  for (const child of element.childNodes) {
    if (child.nodeType === 3) { // Text node
      if (child.textContent.trim()) {
        children.push(createSpan(child.textContent));
      }
    } else if (child.nodeType === 1) { // Element node
      const tagName = child.tagName.toLowerCase();
      switch (tagName) {
        case 'strong':
        case 'b':
          children.push(createSpan(child.textContent, ['strong']));
          break;
        case 'em':
        case 'i':
          children.push(createSpan(child.textContent, ['em']));
          break;
        case 'code':
          children.push(createSpan(child.textContent, ['code']));
          break;
        case 'a':
          children.push(createSpan(child.textContent, [createLink(child.href)]));
          break;
        default:
          children.push(createSpan(child.textContent));
      }
    }
  }
  return children;
}

function processListItems(element, listType) {
  const blocks = [];
  let currentLevel = 1;

  const processLi = (li, level) => {
    const block = createBlock('normal', processChildren(li), listType);
    block.level = level;
    blocks.push(block);

    // Process nested lists
    const nestedList = li.querySelector('ul, ol');
    if (nestedList) {
      const nestedType = nestedList.tagName.toLowerCase() === 'ul' ? 'bullet' : 'number';
      const nestedItems = processListItems(nestedList, nestedType);
      blocks.push(...nestedItems.map(item => ({ ...item, level: level + 1 })));
    }
  };

  for (const li of element.children) {
    if (li.tagName.toLowerCase() === 'li') {
      processLi(li, currentLevel);
    }
  }

  return blocks;
}

function createBlock(style, children, listItem = undefined) {
  const block = {
    _type: 'block',
    style,
    children: children.filter(Boolean)
  };
  
  if (listItem) {
    block.listItem = listItem;
    block.level = 1;
  }
  
  return block;
}

function createSpan(text, marks = []) {
  return {
    _type: 'span',
    text: text.trim(),
    marks: marks
  };
}

function createCodeBlock(content, language) {
  return {
    _type: 'code',
    language: language,
    code: content.trim()
  };
}

function createImageBlock(imgElement) {
  return {
    _type: 'image',
    asset: {
      _type: 'reference',
      _ref: `image-${imgElement.src.split('/').pop()}-${imgElement.width}x${imgElement.height}`
    },
    alt: imgElement.alt || '',
    caption: imgElement.title || ''
  };
}

function createRawHtmlBlock(html) {
  return {
    _type: 'rawHtml',
    html: html
  };
}

function createLink(href) {
  return {
    _type: 'link',
    href
  };
}

async function importBlogPosts() {
  console.log(chalk.blue('Validating blog content...'));
  try {
    await validateBlogContent();
    console.log(chalk.green('Validation successful! Proceeding with import...'));
  } catch (error) {
    console.error(chalk.red('Blog content validation failed. Please fix the issues before importing.'));
    process.exit(1);
  }

  // Store image asset references for reuse
  const imageReferences = {};

  try {
    // Read all markdown files from the blog content directory
    const contentDir = path.join(dirname(dirname(__filename)), 'src', 'content', 'blog');
    
    try {
      await fs.access(contentDir);
    } catch (err) {
      console.log('No blog directory found, skipping import');
      return;
    }

    const files = await fs.readdir(contentDir);
    if (files.length === 0) {
      console.log('No blog posts found, skipping import');
      return;
    }
    const mdFiles = files.filter(file => file.endsWith('.md'));

    for (const file of mdFiles) {
      const filePath = path.join(contentDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const { data: frontmatter, content: markdown } = matter(content);

      // Convert markdown to Portable Text blocks
      const blocks = markdownToPortableText(markdown);

      // Create default category if it doesn't exist
      for (const categoryName of frontmatter.categories) {
        const category = {
          _id: `category-${categoryName.toLowerCase()}`,
          _type: 'category',
          title: categoryName,
          slug: {
            _type: 'slug',
            current: categoryName.toLowerCase(),
          },
        };

        try {
          await client.createIfNotExists(category);
        } catch (err) {
          console.warn(`Warning: Couldn't create category ${categoryName}:`, err.message);
        }
      }

      // Upload any images found in the content
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const imageMatches = [...markdown.matchAll(imageRegex)];
      
      for (const match of imageMatches) {
        const [, alt, src] = match;
        try {
          // Upload image to Sanity
          const imageAsset = await client.assets.upload('image', fetch(src));
          // Store the image reference for use in the content
          imageReferences[src] = imageAsset._id;
        } catch (err) {
          console.warn(`Warning: Couldn't upload image ${src}:`, err.message);
        }
      }

      // Prepare the document
      const doc = {
        _type: 'post',
        _id: `post-${frontmatter.slug}`,
        title: frontmatter.title,
        slug: { _type: 'slug', current: frontmatter.slug },
        publishedAt: frontmatter.publishedAt,
        description: frontmatter.excerpt?.substring(0, 160) || '', // Enforce 160 char limit
        author: frontmatter.author ? {
          _type: 'reference',
          _ref: `author-${frontmatter.author.toLowerCase()}`
        } : undefined,
        mainImage: frontmatter.mainImage ? {
          _type: 'image',
          asset: {
            _type: 'reference',
            _ref: imageReferences[frontmatter.mainImage]
          }
        } : undefined,
        categories: frontmatter.categories.map(category => ({
          _type: 'reference',
          _ref: `category-${category.toLowerCase()}`,
        })),
        body: blocks,
      };

      // Create or update document in Sanity
      const result = await client.createOrReplace(doc);
      console.log(`✓ Imported: ${frontmatter.title}`);
    }

    console.log('\nAll blog posts imported successfully!');
  } catch (error) {
    console.error('Error importing blog posts:', error);
    process.exit(1);
  }
}

// Run the import
importBlogPosts();