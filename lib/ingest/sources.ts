export type DefenseSourceCategory = 'journalism' | 'official' | 'analysis'
export type DefenseSourceQualityTier = 'high' | 'medium' | 'baseline'
export type DefenseSourceBias = 'center' | 'center-left' | 'center-right' | 'official'
export type DefenseSourceCadence = 'hourly' | 'daily' | 'weekly'
export type DefenseSourceStoryRole = 'reporting' | 'analysis' | 'official' | 'opinion'

export interface DefenseFeedSource {
  id: string
  name: string
  category: DefenseSourceCategory
  sourceBadge: string
  feedUrl: string
  homepageUrl: string
  weight: number
  qualityTier: DefenseSourceQualityTier
  bias: DefenseSourceBias
  updateCadence: DefenseSourceCadence
  storyRole: DefenseSourceStoryRole
  topicFocus: string[]
}

export const defenseFeedSources: DefenseFeedSource[] = [
  {
    id: 'breaking-defense',
    name: 'Breaking Defense',
    category: 'journalism',
    sourceBadge: 'Reporting',
    feedUrl: 'https://breakingdefense.com/feed/',
    homepageUrl: 'https://breakingdefense.com/',
    weight: 5,
    qualityTier: 'high',
    bias: 'center',
    updateCadence: 'daily',
    storyRole: 'reporting',
    topicFocus: ['programs', 'procurement', 'space', 'airpower'],
  },
  {
    id: 'defense-news',
    name: 'Defense News',
    category: 'journalism',
    sourceBadge: 'Reporting',
    feedUrl: 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml',
    homepageUrl: 'https://www.defensenews.com/',
    weight: 5,
    qualityTier: 'high',
    bias: 'center',
    updateCadence: 'hourly',
    storyRole: 'reporting',
    topicFocus: ['operations', 'programs', 'budget', 'policy'],
  },
  {
    id: 'c4isrnet',
    name: 'C4ISRNET',
    category: 'journalism',
    sourceBadge: 'Reporting',
    feedUrl: 'https://www.c4isrnet.com/arc/outboundfeeds/rss/?outputType=xml',
    homepageUrl: 'https://www.c4isrnet.com/',
    weight: 4,
    qualityTier: 'high',
    bias: 'center',
    updateCadence: 'daily',
    storyRole: 'reporting',
    topicFocus: ['cyber', 'intelligence', 'space', 'technology'],
  },
  {
    id: 'defense-one',
    name: 'Defense One',
    category: 'journalism',
    sourceBadge: 'Reporting',
    feedUrl: 'https://www.defenseone.com/rss/all/',
    homepageUrl: 'https://www.defenseone.com/',
    weight: 4,
    qualityTier: 'high',
    bias: 'center',
    updateCadence: 'daily',
    storyRole: 'reporting',
    topicFocus: ['policy', 'technology', 'global-security'],
  },
  {
    id: 'the-war-zone',
    name: 'The War Zone',
    category: 'journalism',
    sourceBadge: 'Reporting',
    feedUrl: 'https://www.twz.com/feed',
    homepageUrl: 'https://www.twz.com/',
    weight: 4,
    qualityTier: 'medium',
    bias: 'center',
    updateCadence: 'daily',
    storyRole: 'reporting',
    topicFocus: ['operations', 'systems', 'airpower'],
  },
  {
    id: 'defense-scoop',
    name: 'DefenseScoop',
    category: 'journalism',
    sourceBadge: 'Reporting',
    feedUrl: 'https://defensescoop.com/feed/',
    homepageUrl: 'https://defensescoop.com/',
    weight: 4,
    qualityTier: 'high',
    bias: 'center',
    updateCadence: 'daily',
    storyRole: 'reporting',
    topicFocus: ['cyber', 'government-tech', 'ai'],
  },
  {
    id: 'usni-news',
    name: 'USNI News',
    category: 'journalism',
    sourceBadge: 'Reporting',
    feedUrl: 'https://news.usni.org/feed',
    homepageUrl: 'https://news.usni.org/',
    weight: 4,
    qualityTier: 'medium',
    bias: 'center',
    updateCadence: 'daily',
    storyRole: 'reporting',
    topicFocus: ['naval', 'maritime', 'operations'],
  },
  {
    id: 'naval-news',
    name: 'Naval News',
    category: 'journalism',
    sourceBadge: 'Reporting',
    feedUrl: 'https://www.navalnews.com/feed/',
    homepageUrl: 'https://www.navalnews.com/',
    weight: 3,
    qualityTier: 'medium',
    bias: 'center',
    updateCadence: 'daily',
    storyRole: 'reporting',
    topicFocus: ['naval', 'procurement', 'maritime'],
  },
  {
    id: 'war-on-the-rocks',
    name: 'War on the Rocks',
    category: 'analysis',
    sourceBadge: 'Analysis',
    feedUrl: 'https://warontherocks.com/feed/',
    homepageUrl: 'https://warontherocks.com/',
    weight: 4,
    qualityTier: 'high',
    bias: 'center',
    updateCadence: 'daily',
    storyRole: 'analysis',
    topicFocus: ['strategy', 'policy', 'deterrence'],
  },
  {
    id: 'real-clear-defense',
    name: 'RealClearDefense',
    category: 'analysis',
    sourceBadge: 'Opinion',
    feedUrl: 'https://www.realcleardefense.com/index.xml',
    homepageUrl: 'https://www.realcleardefense.com/',
    weight: 2,
    qualityTier: 'baseline',
    bias: 'center-right',
    updateCadence: 'daily',
    storyRole: 'opinion',
    topicFocus: ['opinion', 'commentary', 'policy'],
  },
  {
    id: 'csis',
    name: 'CSIS',
    category: 'analysis',
    sourceBadge: 'Analysis',
    feedUrl: 'https://www.csis.org/rss.xml',
    homepageUrl: 'https://www.csis.org/',
    weight: 3,
    qualityTier: 'high',
    bias: 'center',
    updateCadence: 'weekly',
    storyRole: 'analysis',
    topicFocus: ['policy', 'strategy', 'regional-analysis'],
  },
  {
    id: 'dod-news',
    name: 'U.S. Department of Defense News',
    category: 'official',
    sourceBadge: 'DoD release',
    feedUrl: 'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=25',
    homepageUrl: 'https://www.defense.gov/News/',
    weight: 5,
    qualityTier: 'high',
    bias: 'official',
    updateCadence: 'daily',
    storyRole: 'official',
    topicFocus: ['official-statements', 'operations', 'policy'],
  },
  {
    id: 'dod-releases',
    name: 'U.S. Department of Defense Releases',
    category: 'official',
    sourceBadge: 'DoD release',
    feedUrl: 'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=400&Site=945&max=25',
    homepageUrl: 'https://www.defense.gov/News/Releases/',
    weight: 5,
    qualityTier: 'high',
    bias: 'official',
    updateCadence: 'daily',
    storyRole: 'official',
    topicFocus: ['press-release', 'budget', 'statements'],
  },
  {
    id: 'us-air-force',
    name: 'U.S. Air Force',
    category: 'official',
    sourceBadge: 'DoD release',
    feedUrl: 'https://www.af.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=1&max=25',
    homepageUrl: 'https://www.af.mil/News/',
    weight: 3,
    qualityTier: 'medium',
    bias: 'official',
    updateCadence: 'daily',
    storyRole: 'official',
    topicFocus: ['service-updates', 'operations', 'programs'],
  },
  {
    id: 'us-marines',
    name: 'U.S. Marine Corps',
    category: 'official',
    sourceBadge: 'DoD release',
    feedUrl: 'https://www.marines.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=1&max=25',
    homepageUrl: 'https://www.marines.mil/News/',
    weight: 3,
    qualityTier: 'medium',
    bias: 'official',
    updateCadence: 'daily',
    storyRole: 'official',
    topicFocus: ['service-updates', 'operations', 'readiness'],
  },
  {
    id: 'uk-mod',
    name: 'UK Ministry of Defence',
    category: 'official',
    sourceBadge: 'Policy doc',
    feedUrl: 'https://www.gov.uk/government/organisations/ministry-of-defence.atom',
    homepageUrl: 'https://www.gov.uk/government/organisations/ministry-of-defence',
    weight: 3,
    qualityTier: 'medium',
    bias: 'official',
    updateCadence: 'daily',
    storyRole: 'official',
    topicFocus: ['policy', 'procurement', 'official-statements'],
  },
]

const sourceById = new Map(defenseFeedSources.map((source) => [source.id, source]))

function normalize(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function getDefenseFeedSourceById(sourceId: string | null | undefined) {
  if (!sourceId) {
    return null
  }

  return sourceById.get(sourceId) ?? null
}

export function resolveSourceStoryRole(input: {
  sourceId?: string | null
  sourceName?: string | null
  sourceBadge?: string | null
  sourceCategory?: string | null
}): DefenseSourceStoryRole {
  const byId = getDefenseFeedSourceById(input.sourceId)

  if (byId) {
    return byId.storyRole
  }

  const badge = normalize(input.sourceBadge)
  const sourceCategory = normalize(input.sourceCategory)
  const sourceName = normalize(input.sourceName)

  if (badge.includes('opinion') || badge.includes('op-ed') || badge.includes('commentary')) {
    return 'opinion'
  }

  if (badge.includes('policy doc') || badge.includes('release') || sourceCategory === 'official') {
    return 'official'
  }

  if (sourceCategory === 'analysis') {
    return 'analysis'
  }

  if (sourceName.includes('realcleardefense')) {
    return 'opinion'
  }

  if (sourceName.includes('war on the rocks') || sourceName.includes('csis')) {
    return 'analysis'
  }

  return 'reporting'
}

export function sourceQualityWeight(tier: DefenseSourceQualityTier) {
  switch (tier) {
    case 'high':
      return 1.25
    case 'medium':
      return 1
    default:
      return 0.82
  }
}
