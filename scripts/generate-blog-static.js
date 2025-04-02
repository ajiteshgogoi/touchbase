import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, '../src/content/blog');
const OUTPUT_DIR = path.join(__dirname, '../dist/blog');

async function generateStaticBlogFiles() {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Get all markdown files
    const files = fs.readdirSync(BLOG_DIR);
    const blogFiles = files.filter(file => file.endsWith('.md'));

    // Generate index.html with blog list
    const blogPosts = blogFiles.map(file => {
      const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
      const { data } = matter(content);
      return {
        slug: file.replace('.md', ''),
        ...data
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Write blog list data
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'posts.json'),
      JSON.stringify(blogPosts, null, 2)
    );

    // Generate static HTML for each blog post
    for (const file of blogFiles) {
      const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
      const { data, content: markdown } = matter(content);
      const html = await marked(markdown);
      
      const postData = {
        content: html,
        ...data
      };

      const slug = file.replace('.md', '');
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `${slug}.json`),
        JSON.stringify(postData, null, 2)
      );
    }

    console.log(`Generated static files for ${blogFiles.length} blog posts`);
  } catch (error) {
    console.error('Error generating static blog files:', error);
    process.exit(1);
  }
}

generateStaticBlogFiles();