import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPosts } from '../../lib/sanity/client';
import { PostListItem } from '../../lib/sanity/types';
import { urlFor } from '../../lib/sanity/client';

export default function BlogList() {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPosts() {
      try {
        const data = await getPosts();
        setPosts(data);
      } catch (error) {
        console.error('Error loading posts:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPosts();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="mb-8">
                <div className="h-64 bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
            Blog
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            Latest posts and updates
          </p>
        </div>
        
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post._id}
              to={`/blog/${post.slug.current}`}
              className="flex flex-col rounded-lg shadow-lg overflow-hidden transition-transform hover:transform hover:scale-105"
            >
              {post.mainImage && (
                <div className="flex-shrink-0">
                  <img
                    className="h-48 w-full object-cover"
                    src={urlFor(post.mainImage).width(600).url()}
                    alt={post.title}
                  />
                </div>
              )}
              <div className="flex-1 bg-white p-6 flex flex-col justify-between">
                <div className="flex-1">
                  {post.categories && post.categories.length > 0 && (
                    <div className="flex space-x-2 mb-3">
                      {post.categories.map((category) => (
                        <span
                          key={category}
                          className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  )}
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-base text-gray-500 line-clamp-3">
                      {post.excerpt}
                    </p>
                  )}
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}