import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = join(__dirname, '../src/content/blog');
const OUTPUT_DIR = join(__dirname, '../public/blog');

async function generateStaticBlogFiles() {
  console.log('Starting blog static file generation...');
  
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

    console.log('Writing posts.json...');
    writeFileSync(
      join(OUTPUT_DIR, 'posts.json'),
      JSON.stringify(blogPosts, null, 2)
    );

    // Generate static HTML for each blog post
    console.log('Generating individual blog post files...');
    for (const file of blogFiles) {
      const content = readFileSync(join(BLOG_DIR, file), 'utf-8');
      const { data, content: markdown } = matter(content);
      const html = await marked(markdown);
      
      const postData = {
        content: html,
        ...data
      };

      const slug = file.replace('.md', '');
      writeFileSync(
        join(OUTPUT_DIR, `${slug}.json`),
        JSON.stringify(postData, null, 2)
      );
      console.log(`Generated ${slug}.json`);
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