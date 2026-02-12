import {DocumentTextIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const defenseStoryType = defineType({
  name: 'defenseStory',
  title: 'Defense Story',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (Rule) => Rule.required().max(110),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'publishedAt',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'deck',
      title: 'Deck',
      description: '1-2 line summary used in the card header.',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(220),
    }),
    defineField({
      name: 'domain',
      type: 'string',
      options: {
        list: [
          {title: 'Land', value: 'land'},
          {title: 'Air', value: 'air'},
          {title: 'Maritime', value: 'maritime'},
          {title: 'Space', value: 'space'},
          {title: 'Cyber', value: 'cyber'},
          {title: 'Multi-domain', value: 'multi-domain'},
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'missionTags',
      title: 'Mission Tags',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      validation: (Rule) => Rule.required().min(1).max(6),
    }),
    defineField({
      name: 'technologyTags',
      title: 'Technology Tags',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      validation: (Rule) => Rule.max(8),
    }),
    defineField({
      name: 'acquisitionStatus',
      title: 'Acquisition Status',
      type: 'string',
      options: {
        list: [
          {title: 'Pre-RFI', value: 'pre-rfi'},
          {title: 'RFI', value: 'rfi'},
          {title: 'RFP', value: 'rfp'},
          {title: 'Source Selection', value: 'source-selection'},
          {title: 'Awarded', value: 'awarded'},
          {title: 'Prototyping', value: 'prototyping'},
          {title: 'LRIP', value: 'lrip'},
          {title: 'FRP', value: 'frp'},
        ],
      },
    }),
    defineField({
      name: 'horizon',
      type: 'string',
      options: {
        list: [
          {title: 'Near term (0-2 years)', value: 'near'},
          {title: 'Medium term (3-7 years)', value: 'medium'},
          {title: 'Long term (8+ years)', value: 'long'},
        ],
      },
    }),
    defineField({
      name: 'sourceBadge',
      title: 'Source Badge',
      type: 'string',
      options: {
        list: [
          {title: 'DoD release', value: 'DoD release'},
          {title: 'SAM.gov', value: 'SAM.gov'},
          {title: 'Program office', value: 'Program office'},
          {title: 'Funding', value: 'Funding'},
          {title: 'Policy doc', value: 'Policy doc'},
          {title: 'Analysis', value: 'Analysis'},
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'sourceUrl',
      title: 'Primary Source URL',
      type: 'url',
    }),
    defineField({
      name: 'track',
      title: 'Briefing Track',
      type: 'string',
      options: {
        list: [
          {title: 'Macro & conflicts', value: 'macro'},
          {title: 'Programs & contracts', value: 'programs'},
          {title: 'Tech & innovation', value: 'tech'},
          {title: 'Capital & funding', value: 'capital'},
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'contentType',
      title: 'Content Type',
      type: 'string',
      options: {
        list: [
          {title: 'Conflict', value: 'conflict'},
          {title: 'Program', value: 'program'},
          {title: 'Budget', value: 'budget'},
          {title: 'Policy', value: 'policy'},
          {title: 'Funding', value: 'funding'},
          {title: 'Tech', value: 'tech'},
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'highImpact',
      type: 'boolean',
      initialValue: false,
      description: 'Pinned into user feeds even when it is outside followed mission tags.',
    }),
    defineField({
      name: 'theNews',
      title: 'The News',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      description: 'Facts only. Avoid speculation in this section.',
      validation: (Rule) => Rule.required().min(2).max(8),
    }),
    defineField({
      name: 'analystView',
      title: "Analyst's View",
      type: 'array',
      of: [defineArrayMember({type: 'analystView'})],
      validation: (Rule) => Rule.required().min(1).max(4),
    }),
    defineField({
      name: 'roomForDisagreement',
      title: 'Room for Disagreement',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      validation: (Rule) => Rule.max(6),
    }),
    defineField({
      name: 'viewFrom',
      title: 'The View From',
      type: 'array',
      of: [defineArrayMember({type: 'viewFrom'})],
      validation: (Rule) => Rule.max(4),
    }),
    defineField({
      name: 'notableLinks',
      title: 'Notable',
      type: 'array',
      of: [defineArrayMember({type: 'notableLink'})],
      validation: (Rule) => Rule.max(8),
    }),
    defineField({
      name: 'featured',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'domain',
      publishedAt: 'publishedAt',
    },
    prepare(selection) {
      const date = selection.publishedAt
        ? new Date(selection.publishedAt).toLocaleDateString('en-US')
        : 'No date'

      return {
        title: selection.title,
        subtitle: `${selection.subtitle || 'Unknown domain'} | ${date}`,
      }
    },
  },
})
