import {defineField, defineType} from 'sanity'

export const notableLinkType = defineType({
  name: 'notableLink',
  title: 'Notable Link',
  type: 'object',
  fields: [
    defineField({
      name: 'label',
      type: 'string',
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: 'url',
      type: 'url',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'source',
      type: 'string',
      options: {
        list: [
          {title: 'Primary', value: 'primary'},
          {title: 'Secondary', value: 'secondary'},
          {title: 'Deep Dive', value: 'deep_dive'},
          {title: 'Critique', value: 'critique'},
        ],
      },
      initialValue: 'primary',
    }),
  ],
  preview: {
    select: {
      title: 'label',
      subtitle: 'url',
    },
  },
})
