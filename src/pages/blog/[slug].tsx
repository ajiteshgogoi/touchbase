import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function BlogPost() {
  const { slug } = useParams();

  useEffect(() => {
    // Redirect to the static blog post page
    window.location.href = `/blog/${slug}.html`;
  }, [slug]);

  return null; // Component will redirect immediately
}