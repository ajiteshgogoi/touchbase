import React from 'react';
import { renderToString } from 'react-dom/server';
import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';
import { PortableText } from '@portabletext/react';
import fs from 'fs/promises';
import path from 'path';
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
const urlFor = (source) => builder.image(source); // Added 'any' type for source
const DIST_DIR = 'dist';
const BLOG_DIR = path.join(DIST_DIR, 'blog');
async function ensureDirectories() {
    await fs.mkdir(DIST_DIR, { recursive: true });
    await fs.mkdir(BLOG_DIR, { recursive: true });
}
function getSiteUrl() {
    return process.env.SITE_URL || 'https://touchbase.site';
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
      body[]{
        ...,
        markDefs[]{
          ...,
          _type == "internalLink" => {
            "slug": reference->slug.current
          }
        }
      },
      "categories": categories[]->title,
      "author": author->{
        name,
        image
      },
      description,
      keywords,
      canonicalUrl,
      ogImage,
      ogTitle,
      ogDescription
    }
  `);
}
function calculateReadingTime(text) {
    const wordsPerMinute = 200;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
}
function processPortableText(blocks) {
    // Convert Portable Text to plain text for SEO
    return blocks
        .map(block => {
        if (block._type !== 'block' || !block.children) {
            return '';
        }
        return block.children.map((child) => child.text).join('');
    })
        .join(' ')
        .trim();
}
async function generateBlogList(posts) {
    const template = await fs.readFile(path.join('src', 'templates', 'blog-list.html'), 'utf-8');
    const processedPosts = posts.map(post => {
        const plainText = processPortableText(post.body);
        const readingTime = calculateReadingTime(plainText);
        return {
            ...post,
            mainImage: post.mainImage ? urlFor(post.mainImage).width(600).url() : null,
            readingTime,
            plainText
        };
    });
    // Generate structured data for blog posts list
    const postsListSchema = posts.map((post, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
            "@type": "BlogPosting",
            "headline": post.title,
            "description": post.description || post.excerpt || "",
            "datePublished": post.publishedAt,
            "dateModified": post._updatedAt,
            "image": post.ogImage ? urlFor(post.ogImage).width(1200).height(630).url()
                : post.mainImage ? urlFor(post.mainImage).width(1200).url()
                    : `${getSiteUrl()}/og.png`,
            "url": post.canonicalUrl || `${getSiteUrl()}/blog/${post.slug.current}`,
            "author": post.author ? {
                "@type": "Organization",
                "url": "https://touchbase.site",
                "name": post.author.name
            } : {
                "@type": "Organization",
                "name": "TouchBase Technologies",
                "url": "https://touchbase.site"
            },
            "publisher": {
                "@type": "Organization",
                "name": "TouchBase Technologies",
                "url": "https://touchbase.site",
                "logo": {
                    "@type": "ImageObject",
                    "url": `${getSiteUrl()}/icon-192.png`
                }
            },
            "keywords": post.keywords?.join(', ') || post.categories?.join(', ') || "",
            "articleSection": post.categories?.[0] || ""
        }
    }));
    let html = template
        .replace('const posts = POSTS_DATA;', `const posts = ${JSON.stringify(processedPosts, null, 2)};`)
        .replace('BLOG_POSTS_LIST_SCHEMA', JSON.stringify(postsListSchema, null, 2));
    await fs.writeFile(path.join(BLOG_DIR, 'index.html'), html);
}
async function generateBlogPost(post) {
    let template = await fs.readFile(path.join('src', 'templates', 'blog-post.html'), 'utf-8');
    const postUrl = `${getSiteUrl()}/blog/${post.slug.current}`;
    const mainImage = post.mainImage ? urlFor(post.mainImage).width(1200).height(675).url() : '';
    const authorImage = post.author?.image ? urlFor(post.author.image).width(40).height(40).url() : '';
    const plainTextContent = processPortableText(post.body);
    const readingTime = calculateReadingTime(plainTextContent);
    // Add progress bar script
    const progressBarScript = '<script>' +
        'document.addEventListener("DOMContentLoaded", () => {' +
        'const updateProgress = () => {' +
        'const winScroll = window.pageYOffset || document.documentElement.scrollTop;' +
        'const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;' +
        // Handle case where height is 0 or less (no scrollbar)
        'const scrolled = height > 0 ? (winScroll / height) * 100 : 0;' +
        'const progressBar = document.getElementById("readingProgress");' +
        'if (progressBar) {' +
        // Ensure width doesn't exceed 100%
        'const newWidth = Math.min(scrolled, 100);' +
        'progressBar.style.width = newWidth + "%";' +
        '}' +
        '};' +
        'window.addEventListener("scroll", updateProgress);' +
        'updateProgress();' + // Initialize progress on load
        '});' +
        '</script>';
    const authorSection = post.author ? `
    <img src="${encodeURI(authorImage)}" alt="${escapeHtml(post.author.name)}" class="rounded-full w-10 h-10 mr-3" />
    <span itemprop="name" class="font-medium">${escapeHtml(post.author.name)}</span>
  ` : '';
    const categoriesSection = post.categories?.length ? post.categories.map(category => `
    <a href="/blog?category=${encodeURIComponent(category)}" class="blog-post-tag">
      ${escapeHtml(category)}
    </a>
  `).join('') : '';
    const mainImageSection = mainImage ? `
    <img src="${encodeURI(mainImage)}" alt="${escapeHtml(post.title)}" class="rounded-lg object-cover w-full h-full" />
  ` : '';
    // Configure PortableText components
    const components = {
        types: {
            span: ({ value }) => React.createElement("span", null, value.text),
            rawHtml: ({ value }) => React.createElement("div", { dangerouslySetInnerHTML: { __html: value.html } })
        },
        block: {
            normal: ({ children }) => React.createElement("p", null, children),
            h1: ({ children }) => React.createElement("h1", { className: "prose h1" }, children),
            h2: ({ children }) => React.createElement("h2", { className: "prose h2" }, children),
            h3: ({ children }) => React.createElement("h3", { className: "prose h3" }, children),
            blockquote: ({ children }) => React.createElement("blockquote", { className: "border-l-4 border-primary-500/20 pl-4 italic my-4 text-gray-600/90" }, children)
        },
        marks: {
            strong: ({ children }) => React.createElement("strong", { className: "font-semibold" }, children),
            em: ({ children }) => React.createElement("em", null, children),
            code: ({ children }) => React.createElement("code", { className: "bg-gray-100/80 px-1.5 py-0.5 rounded text-[14px] text-gray-800" }, children),
            link: ({ value, children }) => (React.createElement("a", { href: value?.href, className: "text-primary-500 hover:text-primary-600 transition-colors duration-200", target: "_blank", rel: "noopener noreferrer" }, children)),
            internalLink: ({ value, children }) => (React.createElement("a", { href: `/blog/${value?.slug}`, className: "text-primary-500 hover:text-primary-600 transition-colors duration-200" }, children))
        },
        list: {
            bullet: ({ children }) => React.createElement("ul", { className: "prose ul" }, children),
            number: ({ children }) => React.createElement("ol", { className: "prose ol" }, children)
        }
    };
    // Convert Portable Text to HTML
    const portableTextHtml = renderToString(React.createElement(PortableText, { value: post.body, components: components }));
    // Helper function to escape HTML content
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    // Debug logging
    const formattedDate = new Date(post.publishedAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    });
    console.log('Date to format:', post.publishedAt);
    console.log('Formatted date:', formattedDate);
    console.log('Template excerpt:', template.substring(template.indexOf('POST_DATE_FORMATTED') - 10, template.indexOf('POST_DATE_FORMATTED') + 30));
    let html = template
        .replace(/POST_TITLE/g, escapeHtml(post.title))
        .replace(/POST_META_DESCRIPTION/g, escapeHtml(post.description || post.excerpt || ''))
        .replace(/POST_KEYWORDS/g, escapeHtml(post.keywords?.join(', ') || post.categories?.join(', ') || ''))
        .replace(/POST_CANONICAL_URL/g, encodeURI(post.canonicalUrl || postUrl))
        .replace(/POST_OG_TITLE/g, escapeHtml(post.ogTitle || post.title))
        .replace(/POST_OG_DESCRIPTION/g, escapeHtml(post.ogDescription || post.description || post.excerpt || ''))
        .replace(/POST_OG_IMAGE/g, encodeURI(post.ogImage ? urlFor(post.ogImage).width(1200).height(630).url() : mainImage))
        .replace(/POST_IMAGE/g, encodeURI(mainImage))
        .replace(/POST_DATE_FORMATTED/g, formattedDate) // Use pre-formatted date
        .replace(/POST_DATE/g, post.publishedAt)
        .replace(/POST_MODIFIED_DATE/g, post._updatedAt)
        .replace(/POST_AUTHOR/g, escapeHtml(post.author?.name || ''))
        .replace(/AUTHOR_IMAGE/g, encodeURI(authorImage))
        .replace(/POST_URL/g, encodeURI(postUrl))
        .replace(/POST_CATEGORY/g, escapeHtml(post.categories?.[0] || ''))
        .replace(/POST_CONTENT_PLAIN/g, escapeHtml(plainTextContent))
        .replace(/SITE_LOGO/g, `${getSiteUrl()}/icon-192.png`)
        .replace(/READING_TIME/g, readingTime.toString())
        .replace('AUTHOR_SECTION', authorSection)
        .replace('CATEGORIES_SECTION', categoriesSection)
        .replace('MAIN_IMAGE', mainImageSection)
        .replace('POST_CONTENT', portableTextHtml)
        .replace('PROGRESS_BAR_SCRIPT', progressBarScript);
    await fs.writeFile(path.join(BLOG_DIR, `${post.slug.current}.html`), html);
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
            }
            catch (error) {
                console.error(`Error generating post ${post.slug.current}:`, error);
                // Continue with other posts even if one fails
            }
        }
        // Verify the files were created
        try {
            const blogFiles = await fs.readdir(BLOG_DIR);
            console.log('Generated blog files:', blogFiles);
        }
        catch (error) {
            console.error('Error reading blog directory:', error);
        }
        console.log('Successfully generated static blog pages!');
    }
    catch (error) {
        console.error('Error generating static blog pages:', error);
        process.exit(1);
    }
}
main();
