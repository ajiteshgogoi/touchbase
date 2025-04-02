import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { BlogMeta } from '../../lib/blog/types';

export default function BlogList() {
  const [posts, setPosts] = useState<BlogMeta[]>([]);
useEffect(() => {
  const loadPosts = async () => {
    try {
      const response = await fetch('/blog/posts.json');
      const data = await response.json();
      setPosts(data);
    } catch (error) {
      console.error('Error loading blog posts:', error);
      setPosts([]);
    }
  };
  loadPosts();
}, []);


  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Helmet>
        <title>Blog - TouchBase</title>
        <meta name="description" content="Latest updates and insights from TouchBase" />
      </Helmet>
      
      <h1 className="text-4xl font-bold mb-8">Blog</h1>
      
      <div className="space-y-8">
        {posts.map((post) => (
          <article key={post.slug} className="border-b pb-8">
            <Link to={`/blog/${post.slug}`} className="block group">
              <h2 className="text-2xl font-semibold mb-2 group-hover:text-blue-600">
                {post.title}
              </h2>
              <div className="text-gray-600 mb-2">
                {new Date(post.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
              <p className="text-gray-700">{post.description}</p>
              <div className="mt-4 flex gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block bg-gray-100 rounded-full px-3 py-1 text-sm font-semibold text-gray-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}