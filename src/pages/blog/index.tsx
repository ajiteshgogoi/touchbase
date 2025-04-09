import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function BlogList() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the static blog page
    window.location.href = '/blog/index.html';
  }, [navigate]);

  return null; // Component will redirect immediately
}