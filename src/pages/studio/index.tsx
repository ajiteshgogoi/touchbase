import { useEffect } from 'react';

const Studio = () => {
  useEffect(() => {
    const projectId = import.meta.env.VITE_SANITY_PROJECT_ID;
    if (projectId) {
      const studioUrl = `https://${projectId}.sanity.studio/`;
      console.log('Redirecting to Sanity Studio:', studioUrl);
      window.location.replace(studioUrl);
    } else {
      console.error('Missing VITE_SANITY_PROJECT_ID environment variable');
    }
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      Redirecting to Sanity Studio...
    </div>
  );
};

export default Studio;