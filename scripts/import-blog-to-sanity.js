import { createClient } from '@sanity/client';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import dotenv from 'dotenv';
import { JSDOM } from 'jsdom';

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
  const html = marked.parse(markdown);
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const blocks = [];

  const blockElements = document.body.children;
  for (const element of blockElements) {
    const block = processElement(element);
    if (block) blocks.push(block);
  }

  return blocks;
}

function processElement(element) {
  const tagName = element.tagName.toLowerCase();
  
  switch (tagName) {
    case 'p':
      return createBlock('normal', processChildren(element));
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
      return createBlock(tagName, processChildren(element));
    case 'blockquote':
      return createBlock('blockquote', processChildren(element));
    case 'ul':
      return createBlock('normal', processListItems(element), 'bullet');
    case 'ol':
      return createBlock('normal', processListItems(element), 'number');
    case 'pre':
      if (element.querySelector('code')) {
        return createCodeBlock(element.textContent);
      }
      return createBlock('normal', processChildren(element));
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

function processListItems(element) {
  const children = [];
  for (const li of element.children) {
    if (li.tagName.toLowerCase() === 'li') {
      children.push(createSpan(li.textContent));
    }
  }
  return children;
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

function createCodeBlock(content) {
  return {
    _type: 'block',
    style: 'normal',
    children: [{
      _type: 'span',
      text: content.trim(),
      marks: ['code']
    }]
  };
}

function createLink(href) {
  return {
    _type: 'link',
    href
  };
}

async function importBlogPosts() {
  try {
    // Read all markdown files from the blog content directory
    const contentDir = path.join(process.cwd(), 'src', 'content', 'blog');
    const files = await fs.readdir(contentDir);
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

      // Prepare the document
      const doc = {
        _type: 'post',
        _id: `post-${frontmatter.slug}`,
        title: frontmatter.title,
        slug: { _type: 'slug', current: frontmatter.slug },
        publishedAt: frontmatter.publishedAt,
        excerpt: frontmatter.excerpt,
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