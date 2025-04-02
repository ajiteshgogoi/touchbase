import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PortableText } from '@portabletext/react';
import { getPost, urlFor } from '../../lib/sanity/client';
import { Post } from '../../lib/sanity/types';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPost() {
      if (!slug) return;
      
      try {
        const data = await getPost(slug);
        setPost(data);
      } catch (error) {
        console.error('Error loading post:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="h-96 bg-gray-200 rounded-lg mb-8"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Post not found</h1>
          <Link 
            to="/blog" 
            className="mt-4 inline-block text-blue-600 hover:text-blue-800"
          >
            ← Back to blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link 
          to="/blog" 
          className="inline-block mb-8 text-blue-600 hover:text-blue-800"
        >
          ← Back to blog
        </Link>

        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {post.title}
          </h1>

          <div className="flex items-center text-gray-600 mb-6">
            {post.author?.image && (
              <img
                src={urlFor(post.author.image).width(40).height(40).url()}
                alt={post.author.name}
                className="rounded-full w-10 h-10 mr-3"
              />
            )}
            <div>
              {post.author?.name && (
                <span className="font-medium">{post.author.name}</span>
              )}
              <time className="block text-sm">
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
            </div>
          </div>

          {post.categories && post.categories.length > 0 && (
            <div className="flex space-x-2">
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
        </header>

        {post.mainImage && (
          <div className="relative h-96 mb-8">
            <img
              src={urlFor(post.mainImage).width(1200).height(675).url()}
              alt={post.title}
              className="rounded-lg object-cover w-full h-full"
            />
          </div>
        )}

        <div className="prose prose-blue max-w-none">
          <PortableText value={post.body} />
        </div>
      </div>
    </article>
  );
}