import { defineConfig } from 'sanity';
import { deskTool } from 'sanity/desk';
import { schemaTypes } from './schemas';

// Define Sanity configuration type
type SanityConfig = {
  projectId: string;
  dataset: string;
};

const config: SanityConfig = {
  projectId: process.env.VITE_SANITY_PROJECT_ID || '',
  dataset: process.env.VITE_SANITY_DATASET || 'production'
};

export default defineConfig({
  name: 'touchbase-content',
  title: 'Touchbase Content Studio',
  
  ...config,

  plugins: [
    deskTool(),
  ],

  schema: {
    types: schemaTypes,
  },

  // Use the standalone studio configuration
  studio: {
    components: {
      navbar: () => null,
    },
  }
});