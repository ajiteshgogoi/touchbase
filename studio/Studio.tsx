import { useEffect } from 'react';

function StudioPage() {
  useEffect(() => {
    // Redirect to Sanity Studio
    const projectId = import.meta.env.VITE_SANITY_PROJECT_ID;
    if (projectId) {
      const studioUrl = `https://${projectId}.sanity.studio/`;
      window.location.href = studioUrl;
    } else {
      console.error('Sanity Project ID not found in environment variables');
    }
  }, []);

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center' 
    }}>
      <p>Redirecting to Sanity Studio...</p>
    </div>
  );
}

export default StudioPage;