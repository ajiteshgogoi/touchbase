import {defineType, defineArrayMember} from 'sanity'

/**
 * This is the schema definition for the rich text fields used for
 * for this blog studio. When you import it in schemas.js it can be
 * reused in other parts of the studio with:
 *  {
 *    name: 'someName',
 *    title: 'Some title',
 *    type: 'blockContent'
 *  }
 */
export default defineType({
  title: 'Block Content',
  name: 'blockContent',
  type: 'array',
  of: [
    defineArrayMember({
      title: 'Block',
      type: 'block',
      // Styles let you set what your user can mark up blocks with. These
      // correspond with HTML tags, but you can set any title or value
      // you want and decide how you want to deal with it where you want to
      // use your content.
      styles: [
        {title: 'Normal', value: 'normal'},
        {title: 'H1', value: 'h1'},
        {title: 'H2', value: 'h2'},
        {title: 'H3', value: 'h3'},
        {title: 'H4', value: 'h4'},
        {title: 'Quote', value: 'blockquote'},
      ],
      lists: [
        {title: 'Bullet', value: 'bullet'},
        {title: 'Number', value: 'number'}
      ],
      // Marks let you mark up inline text in the block editor.
      marks: {
        // Decorators usually describe a single property – e.g. a typographic
        // preference or highlighting by editors.
        decorators: [
          {title: 'Strong', value: 'strong'},
          {title: 'Emphasis', value: 'em'},
        ],
        // Annotations can be any object structure – e.g. a link or a footnote.
        annotations: [
          {
            title: 'URL',
            name: 'link',
            type: 'object',
            fields: [
              {
                title: 'URL',
                name: 'href',
                type: 'url',
              },
            ],
          },
          {
            title: 'Internal Post Link',
            name: 'internalLink',
            type: 'object',
            icon: () => '⭐',
            fields: [
              {
                title: 'Reference',
                name: 'reference',
                type: 'reference',
                to: [{ type: 'post' }],
                options: {
                  disableNew: true,
                },
              },
            ],
          },
        ],
      },
    }),
    // You can add additional types here. Note that you can't use
    // primitive types such as 'string' and 'number' in the same array
    // as a block type.
    defineArrayMember({
      type: 'image',
      options: {hotspot: true},
    }),
    defineArrayMember({
      title: 'Raw HTML',
      name: 'rawHtml',
      type: 'object',
      fields: [
        {
          title: 'HTML Content',
          name: 'html',
          type: 'text',
          validation: Rule => Rule.required()
        }
      ]
    }),
    defineArrayMember({
      title: 'YouTube',
      name: 'youtube',
      type: 'object',
      fields: [
        {
          title: 'YouTube URL',
          name: 'url',
          type: 'url',
          validation: Rule => Rule.required().custom((url: string) => {
            const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
            if (!url) return true; // Let required handle empty
            if (!youtubeRegex.test(url)) {
              return 'Please enter a valid YouTube URL';
            }
            return true;
          })
        }
      ],
      preview: {
        select: {
          url: 'url'
        },
        prepare({url}) {
          return {
            title: 'YouTube Video',
            subtitle: url
          }
        }
      }
    }),
  ],
})
