import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import matter from 'gray-matter';
import { minify } from 'html-minifier';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = join(__dirname, '../src/content/blog');
const ASSETS_DIR = join(__dirname, '../dist/assets');
const PUBLIC_DIR = join(__dirname, '../dist');

const htmlMinifyOptions = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: true
};

// Make sure we have access to the latest CSS
let cssFile = '';
try {
  const assets = readdirSync(ASSETS_DIR);
  cssFile = assets.find(file => file.endsWith('.css')) || '';
} catch (error) {
  console.warn('Could not find CSS file, falling back to index.css');
}

const cssPath = cssFile ? `/assets/${cssFile}` : '/src/index.css';
const OUTPUT_DIR = join(__dirname, '../public/blog');

async function generateStaticBlogFiles() {
  console.log('Starting blog static file generation...');
  console.log('Blog Directory:', BLOG_DIR);
  console.log('Output Directory:', OUTPUT_DIR);
  console.log('CSS Path:', cssPath);
  
  try {
    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      console.log('Creating output directory:', OUTPUT_DIR);
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Get all markdown files
    const files = readdirSync(BLOG_DIR);
    const blogFiles = files.filter(file => file.endsWith('.md'));
    console.log(`Found ${blogFiles.length} blog files`);

    // Generate index.html with blog list
    const blogPosts = blogFiles.map(file => {
      const content = readFileSync(join(BLOG_DIR, file), 'utf-8');
      const { data } = matter(content);
      return {
        slug: file.replace('.md', ''),
        ...data
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Generate JSON for SPA fallback
    console.log('Writing posts.json for SPA fallback...');
    writeFileSync(
      join(OUTPUT_DIR, 'posts.json'),
      JSON.stringify(blogPosts, null, 2)
    );

    // Generate static HTML index page
    console.log('Generating blog index page...');
    const indexTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blog - TouchBase</title>
    <meta name="description" content="Latest updates and insights from TouchBase">
    <link rel="stylesheet" href="${cssPath}">
</head>
<body>
    <div class="max-w-4xl mx-auto px-4 py-8">
        <nav class="mb-8">
            <a href="/" class="text-blue-600 hover:text-blue-800">← Back to TouchBase</a>
        </nav>
        <h1 class="text-4xl font-bold mb-8">Blog</h1>
        <div class="space-y-8">
            ${blogPosts.map(post => `
                <article class="border-b pb-8">
                    <a href="/blog/${post.slug}.html" class="block group">
                        <h2 class="text-2xl font-semibold mb-2 group-hover:text-blue-600">
                            ${post.title}
                        </h2>
                        <div class="text-gray-600 mb-2">
                            ${new Date(post.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </div>
                        <p class="text-gray-700">${post.description}</p>
                        <div class="mt-4 flex gap-2">
                            ${(post.tags || []).map(tag => `
                                <span class="inline-block bg-gray-100 rounded-full px-3 py-1 text-sm font-semibold text-gray-600">
                                    ${tag}
                                </span>
                            `).join('')}
                        </div>
                    </a>
                </article>
            `).join('')}
        </div>
    </div>
</body>
</html>`;

    const indexPage = minify(indexTemplate, htmlMinifyOptions);

    writeFileSync(
      join(OUTPUT_DIR, 'index.html'),
      indexPage
    );
    console.log('Generated blog index page');

    // Generate static HTML for each blog post
    console.log('Generating individual blog post files...');
    for (const file of blogFiles) {
      const content = readFileSync(join(BLOG_DIR, file), 'utf-8');
      const { data, content: markdown } = matter(content);
      const html = await marked(markdown);
      
      const slug = file.replace('.md', '');
      const postTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title} - TouchBase Blog</title>
    <meta name="description" content="${data.description}">
    <link rel="stylesheet" href="${cssPath}">
</head>
<body>
    <div class="max-w-4xl mx-auto px-4 py-8">
        <nav class="mb-8">
            <a href="/blog/" class="text-blue-600 hover:text-blue-800">← Back to Blog</a>
        </nav>
        <article>
            <header class="mb-8">
                <h1 class="text-4xl font-bold mb-4">${data.title}</h1>
                <div class="text-gray-600 mb-4">
                    ${new Date(data.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                </div>
                <div class="flex gap-2">
                    ${(data.tags || []).map(tag => `
                        <span class="inline-block bg-gray-100 rounded-full px-3 py-1 text-sm font-semibold text-gray-600">
                            ${tag}
                        </span>
                    `).join('')}
                </div>
            </header>
            <div class="prose prose-lg max-w-none">
                ${html}
            </div>
        </article>
    </div>
</body>
</html>`;

      const minifiedHtml = minify(postTemplate, htmlMinifyOptions);
      writeFileSync(
        join(OUTPUT_DIR, `${slug}.html`),
        minifiedHtml
      );
      console.log(`Generated ${slug}.html`);
    }

    console.log(`Successfully generated static files for ${blogFiles.length} blog posts`);
  } catch (error) {
    console.error('Error generating static blog files:', error);
    process.exit(1);
  }
}

console.log('Blog static generation script started');
generateStaticBlogFiles()
  .then(() => {
    console.log('Blog static generation completed successfully');
  })
  .catch(error => {
    console.error('Blog static generation failed:', error);
    process.exit(1);
  });