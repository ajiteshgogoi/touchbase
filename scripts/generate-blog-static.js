import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';
import { PortableText } from '@portabletext/react';
import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked'; // For converting portable text to plain text
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const client = createClient({
  projectId: process.env.VITE_SANITY_PROJECT_ID,
  dataset: process.env.VITE_SANITY_DATASET,
  useCdn: true,
  apiVersion: '2024-04-03',
});

const builder = imageUrlBuilder(client);
const urlFor = (source) => builder.image(source);

const DIST_DIR = 'dist';
const BLOG_DIR = path.join(DIST_DIR, 'blog');

async function ensureDirectories() {
  await fs.mkdir(DIST_DIR, { recursive: true });
  await fs.mkdir(BLOG_DIR, { recursive: true });
}

function getSiteUrl() {
  return process.env.SITE_URL || 'https://touchbase.com';
}

async function getAllPosts() {
  return client.fetch(`
    *[_type == "post"] {
      _id,
      title,
      slug,
      mainImage,
      publishedAt,
      _updatedAt,
      excerpt,
      body,
      "categories": categories[]->title,
      "author": author->{
        name,
        image
      }
    }
  `);
}

function processPortableText(blocks) {
  // Convert Portable Text to plain text for SEO
  return blocks
    .map(block => {
      if (block._type !== 'block' || !block.children) {
        return '';
      }
      return block.children.map(child => child.text).join('');
    })
    .join(' ')
    .trim();
}

async function generateBlogList(posts) {
  const template = await fs.readFile(
    path.join('src', 'templates', 'blog-list.html'),
    'utf-8'
  );

  const processedPosts = posts.map(post => ({
    ...post,
    mainImage: post.mainImage ? urlFor(post.mainImage).width(600).url() : null,
  }));

  const html = template.replace(
    'const posts = POSTS_DATA;',
    `const posts = ${JSON.stringify(processedPosts, null, 2)};`
  );

  await fs.writeFile(path.join(BLOG_DIR, 'index.html'), html);
}

async function generateBlogPost(post) {
  const template = await fs.readFile(
    path.join('src', 'templates', 'blog-post.html'),
    'utf-8'
  );

  const postUrl = `${getSiteUrl()}/blog/${post.slug.current}`;
  const mainImage = post.mainImage ? urlFor(post.mainImage).width(1200).height(675).url() : '';
  const authorImage = post.author?.image ? urlFor(post.author.image).width(40).height(40).url() : '';
  const plainTextContent = processPortableText(post.body);

  const authorSection = post.author ? `
    <img src="${authorImage}" alt="${post.author.name}" class="rounded-full w-10 h-10 mr-3" />
    <span itemprop="name" class="font-medium">${post.author.name}</span>
  ` : '';

  const categoriesSection = post.categories?.length ? post.categories.map(category => `
    <span class="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
      ${category}
    </span>
  `).join('') : '';

  const mainImageSection = mainImage ? `
    <img src="${mainImage}" alt="${post.title}" class="rounded-lg object-cover w-full h-full" />
  ` : '';

  // Convert Portable Text to HTML
  const portableTextHtml = await PortableText({ value: post.body });

  let html = template
    .replace(/POST_TITLE/g, post.title)
    .replace(/POST_EXCERPT/g, post.excerpt || '')
    .replace(/POST_IMAGE/g, mainImage)
    .replace(/POST_DATE/g, post.publishedAt)
    .replace(/POST_MODIFIED_DATE/g, post._updatedAt)
    .replace(/POST_AUTHOR/g, post.author?.name || '')
    .replace(/AUTHOR_IMAGE/g, authorImage)
    .replace(/POST_URL/g, postUrl)
    .replace(/POST_KEYWORDS/g, post.categories?.join(', ') || '')
    .replace(/POST_CATEGORY/g, post.categories?.[0] || '')
    .replace(/POST_CONTENT_PLAIN/g, plainTextContent)
    .replace(/SITE_LOGO/g, `${getSiteUrl()}/icon-192.png`)
    .replace('POST_DATE_FORMATTED', new Date(post.publishedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }))
    .replace('AUTHOR_SECTION', authorSection)
    .replace('CATEGORIES_SECTION', categoriesSection)
    .replace('MAIN_IMAGE', mainImageSection)
    .replace('POST_CONTENT', portableTextHtml);

  await fs.writeFile(
    path.join(BLOG_DIR, `${post.slug.current}.html`),
    html
  );
}

async function main() {
  try {
    await ensureDirectories();
    const posts = await getAllPosts();
    
    // Generate blog list page
    await generateBlogList(posts);

    // Generate individual blog posts
    for (const post of posts) {
      await generateBlogPost(post);
    }

    console.log('Successfully generated static blog pages!');
  } catch (error) {
    console.error('Error generating static blog pages:', error);
    process.exit(1);
  }
}

main();