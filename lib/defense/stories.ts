import {groq} from 'next-sanity'

import {computeStoryPersonalizationScore} from '@/lib/user/interests'
import {hasAnyInterests, type UserInterestCollection} from '@/lib/user/types'
import {client} from '@/sanity/lib/client'

import {isBriefingTrack, isQuickFilter, isStation, type BriefingTrack, type QuickFilter, type Station} from './constants'
import {fallbackDefenseStories} from './sample-data'
import type {AnalystViewItem, DefenseSemaformStory, FeedContext, Horizon, NotableLink, ViewFromItem} from './types'

type RawDefenseStory = {
  _id?: string
  title?: string
  slug?: string
  publishedAt?: string
  deck?: string
  domain?: string
  missionTags?: string[]
  technologyTags?: string[]
  acquisitionStatus?: string
  horizon?: string
  sourceBadge?: string
  sourceUrl?: string
  track?: string
  contentType?: string
  highImpact?: boolean
  theNews?: string[]
  analystView?: Array<{
    station?: string
    bullets?: string[]
  }>
  roomForDisagreement?: string[]
  viewFrom?: Array<{
    perspective?: string
    note?: string
  }>
  notableLinks?: Array<{
    label?: string
    url?: string
    source?: string
  }>
  featured?: boolean
}

const defenseStoriesQuery = groq`*[_type == "defenseStory"] | order(featured desc, publishedAt desc)[0...80]{
  _id,
  title,
  "slug": slug.current,
  publishedAt,
  deck,
  domain,
  missionTags,
  technologyTags,
  acquisitionStatus,
  horizon,
  sourceBadge,
  sourceUrl,
  track,
  contentType,
  highImpact,
  theNews,
  analystView[]{
    station,
    bullets
  },
  roomForDisagreement,
  viewFrom[]{
    perspective,
    note
  },
  notableLinks[]{
    label,
    url,
    source
  },
  featured
}`

const validHorizons = new Set<Horizon>(['near', 'medium', 'long'])
const validTracks = new Set<DefenseSemaformStory['track']>(['macro', 'programs', 'tech', 'capital'])
const validContentTypes = new Set<DefenseSemaformStory['contentType']>([
  'conflict',
  'program',
  'budget',
  'policy',
  'funding',
  'tech',
])
const validLinkSources = new Set<NotableLink['source']>(['primary', 'secondary', 'deep_dive', 'critique'])

function cleanTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeAnalystView(value: RawDefenseStory['analystView']): AnalystViewItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!item || !isStation(item.station)) {
        return null
      }

      const bullets = cleanTextList(item.bullets)
      if (bullets.length === 0) {
        return null
      }

      return {
        station: item.station,
        bullets,
      }
    })
    .filter((item): item is AnalystViewItem => item !== null)
}

function normalizeViewFrom(value: RawDefenseStory['viewFrom']): ViewFromItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      const perspective = typeof item?.perspective === 'string' ? item.perspective.trim() : ''
      const note = typeof item?.note === 'string' ? item.note.trim() : ''

      if (!perspective || !note) {
        return null
      }

      return {
        perspective,
        note,
      }
    })
    .filter((item): item is ViewFromItem => item !== null)
}

function normalizeNotableLinks(value: RawDefenseStory['notableLinks']): NotableLink[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized: NotableLink[] = []

  for (const item of value) {
    const label = typeof item?.label === 'string' ? item.label.trim() : ''
    const url = typeof item?.url === 'string' ? item.url.trim() : ''

    if (!label || !url) {
      continue
    }

    const source =
      typeof item.source === 'string' && validLinkSources.has(item.source as NotableLink['source'])
        ? (item.source as NotableLink['source'])
        : undefined

    normalized.push({
      label,
      url,
      source,
    })
  }

  return normalized
}

function normalizeStory(raw: RawDefenseStory): DefenseSemaformStory | null {
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const slug = typeof raw.slug === 'string' ? raw.slug.trim() : ''
  const publishedAt = typeof raw.publishedAt === 'string' ? raw.publishedAt : ''
  const domain = typeof raw.domain === 'string' ? raw.domain.trim() : ''

  if (!title || !slug || !publishedAt || !domain) {
    return null
  }

  const theNews = cleanTextList(raw.theNews)
  if (theNews.length === 0) {
    return null
  }

  const analystView = normalizeAnalystView(raw.analystView)
  if (analystView.length === 0) {
    return null
  }

  const horizon =
    typeof raw.horizon === 'string' && validHorizons.has(raw.horizon as Horizon)
      ? (raw.horizon as Horizon)
      : undefined

  const track =
    typeof raw.track === 'string' && validTracks.has(raw.track as DefenseSemaformStory['track'])
      ? (raw.track as DefenseSemaformStory['track'])
      : 'programs'

  const contentType =
    typeof raw.contentType === 'string' && validContentTypes.has(raw.contentType as DefenseSemaformStory['contentType'])
      ? (raw.contentType as DefenseSemaformStory['contentType'])
      : 'program'

  return {
    id: raw._id || slug,
    title,
    slug,
    publishedAt,
    deck: typeof raw.deck === 'string' ? raw.deck.trim() : undefined,
    domain,
    missionTags: cleanTextList(raw.missionTags),
    technologyTags: cleanTextList(raw.technologyTags),
    acquisitionStatus: typeof raw.acquisitionStatus === 'string' ? raw.acquisitionStatus : undefined,
    horizon,
    sourceBadge: typeof raw.sourceBadge === 'string' ? raw.sourceBadge : 'Analysis',
    sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : undefined,
    track,
    contentType,
    highImpact: Boolean(raw.highImpact),
    theNews,
    analystView,
    roomForDisagreement: cleanTextList(raw.roomForDisagreement),
    viewFrom: normalizeViewFrom(raw.viewFrom),
    notableLinks: normalizeNotableLinks(raw.notableLinks),
    featured: Boolean(raw.featured),
  }
}

function storyTimestamp(story: DefenseSemaformStory) {
  const timestamp = Date.parse(story.publishedAt)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function dedupeValues(values: string[]) {
  const deduped: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    const normalized = value.trim()
    const key = normalized.toLowerCase()

    if (!normalized || seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(normalized)
  }

  return deduped
}

export function insightsForStation(story: DefenseSemaformStory, station: Station): string[] {
  const match = story.analystView.find((item) => item.station === station)

  if (match) {
    return match.bullets
  }

  return story.analystView[0]?.bullets ?? []
}

export function getBlendedAnalystBullets(story: DefenseSemaformStory, maxItems = 4) {
  const merged = dedupeValues(story.analystView.flatMap((entry) => entry.bullets))
  return merged.slice(0, maxItems)
}

export async function getDefenseStories(): Promise<DefenseSemaformStory[]> {
  try {
    const stories = await client.fetch<RawDefenseStory[]>(defenseStoriesQuery)
    const normalizedStories = stories
      .map((story) => normalizeStory(story))
      .filter((story): story is DefenseSemaformStory => story !== null)

    if (normalizedStories.length > 0) {
      return normalizedStories
    }
  } catch (error) {
    console.error('Falling back to local story seed data:', error)
  }

  return fallbackDefenseStories
}

export function resolveMissionInterests(interests?: UserInterestCollection | null) {
  return dedupeValues(interests?.mission ?? [])
}

function keepByTrack(story: DefenseSemaformStory, track: BriefingTrack) {
  return track === 'all' ? true : story.track === track
}

function keepByQuickFilter(story: DefenseSemaformStory, quickFilter: QuickFilter, myMissions: string[]) {
  if (quickFilter === 'all') {
    return true
  }

  if (quickFilter === 'my-missions') {
    return story.missionTags.some((mission) => myMissions.includes(mission)) || story.highImpact
  }

  if (quickFilter === 'budget') {
    return story.contentType === 'budget' || story.contentType === 'policy'
  }

  if (quickFilter === 'programs') {
    return story.contentType === 'program' || story.contentType === 'conflict'
  }

  return story.contentType === 'funding'
}

export function filterStoriesForFeed(stories: DefenseSemaformStory[], context: FeedContext): DefenseSemaformStory[] {
  return stories.filter((story) => keepByTrack(story, context.track) && keepByQuickFilter(story, context.quickFilter, context.myMissions))
}

export function rankStoriesForFeed(stories: DefenseSemaformStory[], interests?: UserInterestCollection | null) {
  const hasPersonalization = interests ? hasAnyInterests(interests) : false

  if (!hasPersonalization || !interests) {
    return [...stories].sort((a, b) => storyTimestamp(b) - storyTimestamp(a))
  }

  return [...stories].sort((a, b) => {
    const scoreDiff = computeStoryPersonalizationScore(b, interests) - computeStoryPersonalizationScore(a, interests)

    if (scoreDiff !== 0) {
      return scoreDiff
    }

    return storyTimestamp(b) - storyTimestamp(a)
  })
}

export function deriveInterestFacetOptions(stories: DefenseSemaformStory[]) {
  const missionTags = dedupeValues(stories.flatMap((story) => story.missionTags)).sort((a, b) => a.localeCompare(b))
  const domains = dedupeValues(stories.map((story) => story.domain)).sort((a, b) => a.localeCompare(b))
  const technologyTags = dedupeValues(stories.flatMap((story) => story.technologyTags)).sort((a, b) => a.localeCompare(b))

  return {
    missionTags,
    domains,
    technologyTags,
  }
}

export function getTopMissionTags(stories: DefenseSemaformStory[], limit = 8) {
  const counts = new Map<string, number>()

  for (const story of stories) {
    for (const mission of story.missionTags) {
      counts.set(mission, (counts.get(mission) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([mission]) => mission)
}

export function groupStoriesByTrack(stories: DefenseSemaformStory[]) {
  return {
    macro: stories.filter((story) => story.track === 'macro'),
    programs: stories.filter((story) => story.track === 'programs'),
    tech: stories.filter((story) => story.track === 'tech'),
    capital: stories.filter((story) => story.track === 'capital'),
  }
}

export function getSignals(stories: DefenseSemaformStory[]) {
  return stories.filter((story) => !story.highImpact).slice(0, 4)
}

export function findStoryBySlug(stories: DefenseSemaformStory[], slug: string) {
  return stories.find((story) => story.slug === slug)
}

export function storiesByMission(stories: DefenseSemaformStory[], mission: string) {
  const target = mission.trim().toLowerCase()
  return stories.filter((story) => story.missionTags.some((tag) => tag.toLowerCase() === target))
}

export function normalizeFeedParams(params?: {station?: string; track?: string; filter?: string}) {
  return {
    track: isBriefingTrack(params?.track) ? params.track : 'all',
    filter: isQuickFilter(params?.filter) ? params.filter : 'all',
  }
}
