import {defineArrayMember, defineField, defineType} from 'sanity'

export const analystViewType = defineType({
  name: 'analystView',
  title: "Analyst's View",
  type: 'object',
  fields: [
    defineField({
      name: 'station',
      type: 'string',
      options: {
        list: [
          {title: 'Founder / BD', value: 'founder'},
          {title: 'Prime PM / Capture', value: 'prime_pm'},
          {title: 'Investor', value: 'investor'},
          {title: 'Policy / Staff', value: 'policy'},
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'bullets',
      title: 'Bullets',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      validation: (Rule) => Rule.required().min(1).max(6),
    }),
  ],
  preview: {
    select: {
      station: 'station',
      bullets: 'bullets',
    },
    prepare(selection) {
      const bulletCount = Array.isArray(selection.bullets) ? selection.bullets.length : 0
      return {
        title: selection.station || 'Station not set',
        subtitle: `${bulletCount} insight ${bulletCount === 1 ? 'bullet' : 'bullets'}`,
      }
    },
  },
})
