import React, { useEffect } from 'react';
import { client } from '../src/lib/sanity/client';

const Studio = () => {
  useEffect(() => {
    const { projectId } = client.config();
    if (projectId) {
      const studioUrl = `https://${projectId}.sanity.studio/`;
      console.log('Redirecting to Sanity Studio:', studioUrl);
      window.location.assign(studioUrl);
    } else {
      console.error('Missing Sanity Project ID');
    }
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      Redirecting to Sanity Studio...
    </div>
  );
};

export default Studio;