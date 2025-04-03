import React from 'react';
import { renderToString } from 'react-dom/server';
import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';
import { PortableText, PortableTextComponents } from '@portabletext/react';
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
const urlFor = (source: any) => builder.image(source); // Added 'any' type for source

const DIST_DIR = 'dist';
const BLOG_DIR = path.join(DIST_DIR, 'blog');

async function ensureDirectories() {
  await fs.mkdir(DIST_DIR, { recursive: true });
  await fs.mkdir(BLOG_DIR, { recursive: true });
}

function getSiteUrl() {
  return process.env.SITE_URL || 'https://touchbase.com';
}

// Define basic types for Sanity data (replace with more specific types if available)
interface SanityImageSource {
  _type: 'image';
  asset: {
    _ref: string;
    _type: 'reference';
  };
  // Add other image properties if needed
}

interface SanitySlug {
  _type: 'slug';
  current: string;
}

interface SanityAuthor {
  name: string;
  image?: SanityImageSource;
}

interface SanityPost {
  _id: string;
  title: string;
  slug: SanitySlug;
  mainImage?: SanityImageSource;
  publishedAt: string;
  _updatedAt: string;
  excerpt?: string;
  body: any[]; // Portable Text content
  categories?: string[];
  author?: SanityAuthor;
}

async function getAllPosts(): Promise<SanityPost[]> {
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

function processPortableText(blocks: any[]): string {
  // Convert Portable Text to plain text for SEO
  return blocks
    .map(block => {
      if (block._type !== 'block' || !block.children) {
        return '';
      }
      return block.children.map((child: any) => child.text).join('');
    })
    .join(' ')
    .trim();
}

async function generateBlogList(posts: SanityPost[]) {
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

async function generateBlogPost(post: SanityPost) {
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

  // Configure PortableText components
  const components: PortableTextComponents = {
    types: {
      span: ({ value }) => <span>{value.text}</span>  // Handle span type explicitly
    },
    block: {
      normal: ({ children }) => <p>{children}</p>,
      h1: ({ children }) => <h1 className="text-3xl font-bold mt-8 mb-4">{children}</h1>,
      h2: ({ children }) => <h2 className="text-2xl font-bold mt-6 mb-3">{children}</h2>,
      h3: ({ children }) => <h3 className="text-xl font-bold mt-4 mb-2">{children}</h3>,
      blockquote: ({ children }) => <blockquote className="border-l-4 pl-4 italic my-4">{children}</blockquote>
    },
    marks: {
      strong: ({ children }) => <strong>{children}</strong>,
      em: ({ children }) => <em>{children}</em>,
      code: ({ children }) => <code className="bg-gray-100 px-1 rounded">{children}</code>,
      link: ({ value, children }) => (
        <a href={value?.href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    },
    list: {
      bullet: ({ children }) => <ul className="list-disc pl-6 my-4">{children}</ul>,
      number: ({ children }) => <ol className="list-decimal pl-6 my-4">{children}</ol>
    }
  };

  // Convert Portable Text to HTML
  const portableTextHtml = renderToString(<PortableText value={post.body} components={components} />);

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
    console.log('Creating directories...');
    await ensureDirectories();
    
    console.log('Fetching blog posts from Sanity...');
    const posts = await getAllPosts();
    console.log(`Found ${posts.length} posts to generate`);

    // Generate blog list page
    console.log('Generating blog list page...');
    await generateBlogList(posts);
    console.log('Blog list page generated successfully');

    // Generate individual blog posts
    console.log('Generating individual blog posts...');
    for (const post of posts) {
      try {
        console.log(`Generating post: ${post.title}...`);
        await generateBlogPost(post);
        console.log(`Generated: ${post.slug.current}`);
      } catch (error) {
        console.error(`Error generating post ${post.slug.current}:`, error);
        // Continue with other posts even if one fails
      }
    }

    // Verify the files were created
    try {
      const blogFiles = await fs.readdir(BLOG_DIR);
      console.log('Generated blog files:', blogFiles);
    } catch (error) {
      console.error('Error reading blog directory:', error);
    }

    console.log('Successfully generated static blog pages!');
  } catch (error) {
    console.error('Error generating static blog pages:', error);
    process.exit(1);
  }
}

main();