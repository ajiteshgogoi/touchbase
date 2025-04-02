import { defineConfig } from 'sanity';
import { deskTool } from 'sanity/desk';
import { schemaTypes } from './schemas';

export default defineConfig({
  name: 'touchbase-blog',
  title: 'TouchBase Blog',
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID,
  dataset: import.meta.env.VITE_SANITY_DATASET,
  plugins: [
    deskTool(),
  ],
  schema: {
    types: schemaTypes,
  }
});