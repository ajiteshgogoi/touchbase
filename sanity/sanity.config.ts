/** @jsx React.createElement */
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import React, { FC } from 'react'

// Custom logo component
const Logo: FC = () => {
  return React.createElement('img', {
    src: 'favicon.svg',
    alt: 'TouchBase',
    style: { height: '2em' }
  })
}

export default defineConfig({
  name: 'default',
  title: 'TouchBase Blog',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || '',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  basePath: '/studio', // Mount Sanity Studio at /studio

  studio: {
    components: {
      logo: Logo
    }
  },

  plugins: [structureTool(), visionTool()],

  schema: {
    types: schemaTypes,
  },
})
