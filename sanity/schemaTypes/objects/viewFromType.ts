import {defineField, defineType} from 'sanity'

export const viewFromType = defineType({
  name: 'viewFrom',
  title: 'The View From',
  type: 'object',
  fields: [
    defineField({
      name: 'perspective',
      type: 'string',
      description: 'Operator, acquisition, industry, investor, etc.',
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: 'note',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.required().max(280),
    }),
  ],
  preview: {
    select: {
      title: 'perspective',
      subtitle: 'note',
    },
  },
})
