import { createClient } from '@sanity/client';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { markdownToBlocks } from '@portabletext/block-tools';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const client = createClient({
  projectId: process.env.VITE_SANITY_PROJECT_ID,
  dataset: process.env.VITE_SANITY_DATASET,
  token: process.env.VITE_SANITY_TOKEN, // Need a token with write access
  apiVersion: '2024-04-03',
  useCdn: false,
});

const blockContentType = {
  name: 'blockContent',
  type: 'array',
  of: [
    {
      type: 'block',
      styles: [
        { title: 'Normal', value: 'normal' },
        { title: 'H1', value: 'h1' },
        { title: 'H2', value: 'h2' },
        { title: 'H3', value: 'h3' },
        { title: 'H4', value: 'h4' },
        { title: 'Quote', value: 'blockquote' },
      ],
      marks: {
        decorators: [
          { title: 'Strong', value: 'strong' },
          { title: 'Emphasis', value: 'em' },
          { title: 'Code', value: 'code' },
        ],
      },
    },
  ],
};

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

      // Convert markdown content to Portable Text blocks
      const blocks = markdownToBlocks(markdown, blockContentType);

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