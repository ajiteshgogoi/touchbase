import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import type { BlogPost } from '../../lib/blog/types';
import { getBlogPost } from '../../lib/blog/utils';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPost = async () => {
      if (!slug) return;
      
      setLoading(true);
      try {
        // Try static file first (production)
        const response = await fetch(`/blog/${slug}.json`);
        if (response.ok) {
          const data = await response.json();
          setPost({
            slug,
            title: data.title,
            date: data.date,
            description: data.description,
            content: data.content,
            tags: data.tags || []
          });
          return;
        }
      } catch (error) {
        console.log('Falling back to direct post loading');
      }

      // Development mode: use utils
      try {
        const postData = await getBlogPost(slug);
        if (postData) {
          setPost(postData);
        } else {
          setPost(null);
        }
      } catch (error) {
        console.error('Error loading blog post:', error);
        setPost(null);
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Post not found</h1>
        <p>The blog post you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Helmet>
        <title>{post.title} - TouchBase Blog</title>
        <meta name="description" content={post.description} />
      </Helmet>

      <article>
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <div className="text-gray-600 mb-4">
          {new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
        
        <div className="flex gap-2 mb-8">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="inline-block bg-gray-100 rounded-full px-3 py-1 text-sm font-semibold text-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>

        <div 
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>
    </div>
  );
}