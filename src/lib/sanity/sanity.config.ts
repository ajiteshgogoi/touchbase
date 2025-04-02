import { defineConfig } from 'sanity';
import { deskTool } from 'sanity/desk';
import { schemaTypes } from './schemas';

export default defineConfig({
  name: 'touchbase-blog',
  title: 'TouchBase Blog',
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID,
  dataset: import.meta.env.VITE_SANITY_DATASET,
  basePath: '/studio', // Mount Sanity Studio at /studio
  plugins: [
    deskTool()
  ],
  schema: {
    types: schemaTypes,
  }
});