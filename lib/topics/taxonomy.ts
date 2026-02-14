import {slugifyTopic} from './slug'

export const topicTypeValues = [
  'organization',
  'program',
  'technology',
  'company',
  'geography',
  'acronym',
  'person',
] as const

export type TopicType = (typeof topicTypeValues)[number]

export type TaxonomyTopic = {
  label: string
  slug: string
  topicType: TopicType
  aliases: string[]
}

const taxonomySeed: Array<Omit<TaxonomyTopic, 'slug'>> = [
  {
    label: 'Department of Defense',
    topicType: 'organization',
    aliases: ['DoD', 'U.S. Department of Defense', 'US Department of Defense'],
  },
  {
    label: 'Small Business Innovation Research',
    topicType: 'program',
    aliases: ['SBIR', 'SBIR program'],
  },
  {
    label: 'Defense Advanced Research Projects Agency',
    topicType: 'organization',
    aliases: ['DARPA'],
  },
  {
    label: 'Defense Innovation Unit',
    topicType: 'organization',
    aliases: ['DIU'],
  },
  {
    label: 'U.S. Air Force',
    topicType: 'organization',
    aliases: ['USAF', 'Air Force'],
  },
  {
    label: 'U.S. Navy',
    topicType: 'organization',
    aliases: ['US Navy', 'Navy'],
  },
  {
    label: 'U.S. Army',
    topicType: 'organization',
    aliases: ['US Army', 'Army'],
  },
  {
    label: 'U.S. Marine Corps',
    topicType: 'organization',
    aliases: ['USMC', 'Marines', 'Marine Corps'],
  },
  {
    label: 'U.S. Space Force',
    topicType: 'organization',
    aliases: ['USSF', 'Space Force'],
  },
  {
    label: 'North Atlantic Treaty Organization',
    topicType: 'organization',
    aliases: ['NATO'],
  },
  {
    label: 'U.S. Indo-Pacific Command',
    topicType: 'organization',
    aliases: ['INDOPACOM'],
  },
  {
    label: 'U.S. Central Command',
    topicType: 'organization',
    aliases: ['CENTCOM'],
  },
  {
    label: 'Joint All-Domain Command and Control',
    topicType: 'program',
    aliases: ['JADC2', 'Joint C2'],
  },
  {
    label: 'Replicator Initiative',
    topicType: 'program',
    aliases: ['Replicator'],
  },
  {
    label: 'Foreign Military Sales',
    topicType: 'program',
    aliases: ['FMS'],
  },
  {
    label: 'AUKUS',
    topicType: 'program',
    aliases: ['AUKUS partnership'],
  },
  {
    label: 'Golden Dome',
    topicType: 'program',
    aliases: ['Golden Dome missile shield'],
  },
  {
    label: 'Hypersonics',
    topicType: 'technology',
    aliases: ['hypersonic', 'hypersonic weapons'],
  },
  {
    label: 'Counter-UAS',
    topicType: 'technology',
    aliases: ['counter drone', 'counter-UAS', 'C-UAS'],
  },
  {
    label: 'Artificial Intelligence',
    topicType: 'technology',
    aliases: ['AI', 'AI/ML', 'machine learning'],
  },
  {
    label: 'Satellite Communications',
    topicType: 'technology',
    aliases: ['SATCOM'],
  },
  {
    label: 'Missile Defense',
    topicType: 'technology',
    aliases: ['air and missile defense'],
  },
  {
    label: 'Cybersecurity',
    topicType: 'technology',
    aliases: ['cyber', 'zero trust'],
  },
  {
    label: 'Anduril Industries',
    topicType: 'company',
    aliases: ['Anduril'],
  },
  {
    label: 'Palantir Technologies',
    topicType: 'company',
    aliases: ['Palantir'],
  },
  {
    label: 'Lockheed Martin',
    topicType: 'company',
    aliases: ['Lockheed'],
  },
  {
    label: 'RTX',
    topicType: 'company',
    aliases: ['Raytheon', 'RTX Corp'],
  },
  {
    label: 'Northrop Grumman',
    topicType: 'company',
    aliases: ['Northrop'],
  },
  {
    label: 'Boeing Defense',
    topicType: 'company',
    aliases: ['Boeing'],
  },
  {
    label: 'General Dynamics',
    topicType: 'company',
    aliases: ['GD', 'GDIT'],
  },
  {
    label: 'L3Harris',
    topicType: 'company',
    aliases: ['L3 Harris', 'L3Harris Technologies'],
  },
  {
    label: 'Leidos',
    topicType: 'company',
    aliases: ['Leidos Holdings'],
  },
  {
    label: 'Huntington Ingalls Industries',
    topicType: 'company',
    aliases: ['HII', 'Huntington Ingalls'],
  },
  {
    label: 'AeroVironment',
    topicType: 'company',
    aliases: ['AeroVironment Inc'],
  },
  {
    label: 'Kratos Defense & Security Solutions',
    topicType: 'company',
    aliases: ['Kratos Defense', 'Kratos'],
  },
  {
    label: 'CACI International',
    topicType: 'company',
    aliases: ['CACI'],
  },
  {
    label: 'Middle East',
    topicType: 'geography',
    aliases: ['Gulf region'],
  },
  {
    label: 'Indo-Pacific',
    topicType: 'geography',
    aliases: ['Indopacific', 'Asia-Pacific'],
  },
  {
    label: 'Ukraine',
    topicType: 'geography',
    aliases: ['Ukrainian'],
  },
  {
    label: 'Russia',
    topicType: 'geography',
    aliases: ['Russian'],
  },
  {
    label: 'China',
    topicType: 'geography',
    aliases: ['PRC'],
  },
]

export const curatedTopicTaxonomy: TaxonomyTopic[] = taxonomySeed.map((entry) => ({
  ...entry,
  slug: slugifyTopic(entry.label),
}))
