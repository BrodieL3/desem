import {createOptionalSupabaseServerClient} from '@/lib/supabase/server'
import {hasAnyInterests, type UserInterestCollection} from '@/lib/user/types'

import {classifyPulledArticle} from './tagging'

export interface IngestedFeedArticle {
  id: string
  title: string
  summary?: string
  articleUrl: string
  sourceName: string
  sourceBadge: string
  publishedAt?: string
  fetchedAt: string
  missionTags: string[]
  domainTags: string[]
  technologyTags: string[]
  track: 'macro' | 'programs' | 'tech' | 'capital'
  contentType: 'conflict' | 'program' | 'budget' | 'policy' | 'funding' | 'tech'
  highImpact: boolean
  personalizationScore: number
}

type IngestedArticleRow = {
  id: string
  title: string
  summary: string | null
  article_url: string
  source_name: string
  source_category: string | null
  source_badge: string
  published_at: string | null
  fetched_at: string
  mission_tags?: string[] | null
  domain_tags?: string[] | null
  technology_tags?: string[] | null
  track?: string | null
  content_type?: string | null
  high_impact?: boolean | null
}

type PostgrestLikeError = {
  code?: string | null
  message: string
}

const fallbackTrack: IngestedFeedArticle['track'] = 'programs'
const fallbackContentType: IngestedFeedArticle['contentType'] = 'program'

function normalizeKey(value: string) {
  return value.trim().toLowerCase()
}

function cleanTags(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) {
    return []
  }

  const deduped: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }

    const trimmed = value.trim()
    const key = normalizeKey(trimmed)

    if (!trimmed || seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(trimmed)
  }

  return deduped
}

function isSchemaCacheTableError(error: PostgrestLikeError | null | undefined) {
  if (!error) {
    return false
  }

  if (error.code === 'PGRST205') {
    return true
  }

  const message = error.message.toLowerCase()
  return message.includes('schema cache') && message.includes('could not find the table')
}

function missingTagColumnError(error: PostgrestLikeError | null | undefined) {
  if (!error) {
    return false
  }

  const message = error.message.toLowerCase()
  return message.includes('could not find') && (message.includes('mission_tags') || message.includes('domain_tags') || message.includes('technology_tags') || message.includes('content_type') || message.includes('high_impact') || message.includes('track'))
}

function resolveTrack(value: string | null | undefined): IngestedFeedArticle['track'] {
  if (value === 'macro' || value === 'programs' || value === 'tech' || value === 'capital') {
    return value
  }

  return fallbackTrack
}

function resolveContentType(value: string | null | undefined): IngestedFeedArticle['contentType'] {
  if (value === 'conflict' || value === 'program' || value === 'budget' || value === 'policy' || value === 'funding' || value === 'tech') {
    return value
  }

  return fallbackContentType
}

function timestamp(value: string | undefined) {
  if (!value) {
    return 0
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function classifyFromRow(row: IngestedArticleRow) {
  const sourceCategory = row.source_category === 'official' || row.source_category === 'analysis' ? row.source_category : 'journalism'

  return classifyPulledArticle({
    sourceId: row.id,
    sourceName: row.source_name,
    sourceCategory,
    sourceBadge: row.source_badge,
    sourceFeedUrl: '',
    sourceHomepageUrl: '',
    sourceWeight: 1,
    title: row.title,
    url: row.article_url,
    summary: row.summary || '',
    publishedAt: row.published_at || undefined,
  })
}

function mapRowToFeedArticle(row: IngestedArticleRow): IngestedFeedArticle {
  const fallbackClassification = classifyFromRow(row)
  const missionTags = cleanTags(row.mission_tags)
  const domainTags = cleanTags(row.domain_tags)
  const technologyTags = cleanTags(row.technology_tags)

  return {
    id: row.id,
    title: row.title,
    summary: row.summary || undefined,
    articleUrl: row.article_url,
    sourceName: row.source_name,
    sourceBadge: row.source_badge,
    publishedAt: row.published_at || undefined,
    fetchedAt: row.fetched_at,
    missionTags: missionTags.length > 0 ? missionTags : fallbackClassification.missionTags,
    domainTags: domainTags.length > 0 ? domainTags : fallbackClassification.domainTags,
    technologyTags: technologyTags.length > 0 ? technologyTags : fallbackClassification.technologyTags,
    track: row.track ? resolveTrack(row.track) : fallbackClassification.track,
    contentType: row.content_type ? resolveContentType(row.content_type) : fallbackClassification.contentType,
    highImpact: row.high_impact ?? fallbackClassification.highImpact,
    personalizationScore: 0,
  }
}

function scoreArticleAgainstInterests(article: IngestedFeedArticle, interests?: UserInterestCollection | null) {
  if (!interests || !hasAnyInterests(interests)) {
    return 0
  }

  const missionSet = new Set(interests.mission.map(normalizeKey))
  const domainSet = new Set(interests.domain.map(normalizeKey))
  const techSet = new Set(interests.tech.map(normalizeKey))

  const missionMatches = article.missionTags.reduce((count, tag) => count + Number(missionSet.has(normalizeKey(tag))), 0)
  const domainMatches = article.domainTags.reduce((count, tag) => count + Number(domainSet.has(normalizeKey(tag))), 0)
  const techMatches = article.technologyTags.reduce((count, tag) => count + Number(techSet.has(normalizeKey(tag))), 0)

  return missionMatches * 3 + domainMatches * 2 + techMatches + Number(article.highImpact)
}

export function rankIngestedArticlesForFeed(
  articles: IngestedFeedArticle[],
  interests?: UserInterestCollection | null
): IngestedFeedArticle[] {
  return [...articles]
    .map((article) => ({
      ...article,
      personalizationScore: scoreArticleAgainstInterests(article, interests),
    }))
    .sort((a, b) => {
      const scoreDiff = b.personalizationScore - a.personalizationScore

      if (scoreDiff !== 0) {
        return scoreDiff
      }

      return timestamp(b.publishedAt) - timestamp(a.publishedAt)
    })
}

export async function getRecentIngestedArticles(limit = 60): Promise<IngestedFeedArticle[]> {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return []
  }

  const boundedLimit = Math.max(1, Math.min(limit, 300))

  const taggedSelect =
    'id, title, summary, article_url, source_name, source_category, source_badge, published_at, fetched_at, mission_tags, domain_tags, technology_tags, track, content_type, high_impact'

  const taggedResult = await supabase
    .from('ingested_articles')
    .select(taggedSelect)
    .order('published_at', {ascending: false, nullsFirst: false})
    .order('fetched_at', {ascending: false})
    .limit(boundedLimit)
    .returns<IngestedArticleRow[]>()

  if (taggedResult.error) {
    if (isSchemaCacheTableError(taggedResult.error)) {
      return []
    }

    if (!missingTagColumnError(taggedResult.error)) {
      console.error('Unable to fetch ingested articles:', taggedResult.error.message)
      return []
    }

    const legacySelect =
      'id, title, summary, article_url, source_name, source_category, source_badge, published_at, fetched_at'

    const legacyResult = await supabase
      .from('ingested_articles')
      .select(legacySelect)
      .order('published_at', {ascending: false, nullsFirst: false})
      .order('fetched_at', {ascending: false})
      .limit(boundedLimit)
      .returns<IngestedArticleRow[]>()

    if (legacyResult.error || !legacyResult.data) {
      console.error('Unable to fetch ingested articles (legacy schema):', legacyResult.error?.message)
      return []
    }

    return legacyResult.data.map((row) => mapRowToFeedArticle(row))
  }

  if (!taggedResult.data) {
    return []
  }

  return taggedResult.data.map((row) => mapRowToFeedArticle(row))
}
