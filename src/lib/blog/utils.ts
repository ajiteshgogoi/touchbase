import { marked } from 'marked';
import matter from 'gray-matter';
import { BlogPost, BlogMeta } from './types';

// Use Vite's import.meta.glob for development
const blogFiles = Object.entries(import.meta.glob('/src/content/blog/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
})) as [string, string][];

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const file = blogFiles.find(([path]) => path.includes(slug));
    
    if (!file) {
      throw new Error(`Blog post not found: ${slug}`);
    }

    const fileContent = file[1];
    const { data, content: markdown } = matter(fileContent);
    const parsedContent = await marked(markdown);
    
    return {
      slug,
      title: data.title as string,
      date: data.date as string,
      description: data.description as string,
      tags: (data.tags as string[]) || [],
      content: parsedContent
    };
  } catch (error) {
    console.error(`Error loading blog post ${slug}:`, error);
    return null;
  }
}

export function getAllBlogPosts(): BlogMeta[] {
  try {
    return blogFiles
      .map(([path, content]) => {
        const slug = path.split('/').pop()?.replace('.md', '') || '';
        const { data } = matter(content);
        
        return {
          slug,
          title: data.title as string,
          date: data.date as string,
          description: data.description as string,
          tags: (data.tags as string[]) || []
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
    return blogFiles
      .map(([path]) => path.split('/').pop()?.replace('.md', '') || '');
  } catch (error) {
    console.error('Error generating static paths:', error);
    return [];
  }
}