import { marked } from 'marked';
import matter from 'gray-matter';
import fs from 'fs';
import path from 'path';
import { BlogPost, BlogMeta } from './types';

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const filePath = path.join(BLOG_DIR, `${slug}.md`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);
    const parsedContent = await marked(content);
    
    return {
      slug,
      title: data.title,
      date: data.date,
      description: data.description,
      tags: data.tags || [],
      content: parsedContent
    };
  } catch (error) {
    console.error(`Error loading blog post ${slug}:`, error);
    return null;
  }
}

export function getAllBlogPosts(): BlogMeta[] {
  try {
    const files = fs.readdirSync(BLOG_DIR);
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => {
        const slug = file.replace('.md', '');
        const filePath = path.join(BLOG_DIR, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { data } = matter(fileContent);
        
        return {
          slug,
          title: data.title,
          date: data.date,
          description: data.description,
          tags: data.tags || []
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error loading blog posts:', error);
    return [];
  }
}

export function generateStaticPaths(): string[] {
  try {
    const files = fs.readdirSync(BLOG_DIR);
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => file.replace('.md', ''));
  } catch (error) {
    console.error('Error generating static paths:', error);
    return [];
  }
}