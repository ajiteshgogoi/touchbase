import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  groups: [
    {
      name: 'content',
      title: 'Content',
    },
    {
      name: 'seo',
      title: 'SEO & Metadata',
    },
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: {type: 'author'},
    }),
    defineField({
      name: 'mainImage',
      title: 'Main image',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{type: 'reference', to: {type: 'category'}}],
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
    }),
    defineField({
      name: 'description',
      title: 'Meta Description',
      type: 'text',
      description: 'Brief description for search results (recommended: 150-160 characters)',
      validation: Rule => Rule.max(160),
      group: 'seo',
    }),
    defineField({
      name: 'keywords',
      title: 'Keywords',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Main keywords describing the post content',
      group: 'seo',
    }),
    defineField({
      name: 'canonicalUrl',
      title: 'Canonical URL',
      type: 'url',
      description: 'The preferred version of this page for search engines',
      group: 'seo',
    }),
    defineField({
      name: 'ogImage',
      title: 'Social Media Image',
      type: 'image',
      description: 'Image for social media sharing (recommended: 1200x630 pixels)',
      options: {
        hotspot: true,
      },
      group: 'seo',
    }),
    defineField({
      name: 'ogTitle',
      title: 'Social Media Title',
      type: 'string',
      description: 'Custom title for social media sharing (if different from post title)',
      group: 'seo',
    }),
    defineField({
      name: 'ogDescription',
      title: 'Social Media Description',
      type: 'text',
      description: 'Custom description for social media sharing (if different from meta description)',
      validation: Rule => Rule.max(200),
      group: 'seo',
    }),
  ],

  preview: {
    select: {
      title: 'title',
      author: 'author.name',
      media: 'mainImage',
    },
    prepare(selection) {
      const {author} = selection
      return {...selection, subtitle: author && `by ${author}`}
    },
  },
})
