import {createClient, type SupabaseClient} from '@supabase/supabase-js'

import {classifyPulledArticle} from './tagging'
import {resolveDefenseSources, type PullDefenseArticlesResult} from './pull-defense-articles'

export interface PersistDefenseArticlesResult {
  upsertedSourceCount: number
  upsertedArticleCount: number
  usedLegacySchema: boolean
}

type NewsSourceRow = {
  id: string
  name: string
  category: string
  source_badge: string
  feed_url: string
  homepage_url: string
  weight: number
  last_ingested_at: string
}

type IngestedArticleRow = {
  source_id: string
  source_name: string
  source_category: string
  source_badge: string
  article_url: string
  canonical_url: string
  title: string
  summary: string | null
  author: string | null
  guid: string | null
  mission_tags: string[]
  domain_tags: string[]
  technology_tags: string[]
  track: string
  content_type: string
  high_impact: boolean
  published_at: string | null
  fetched_at: string
}

type LegacyIngestedArticleRow = {
  source_id: string
  source_name: string
  source_category: string
  source_badge: string
  article_url: string
  canonical_url: string
  title: string
  summary: string | null
  author: string | null
  guid: string | null
  published_at: string | null
  fetched_at: string
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function buildSourceRows(result: PullDefenseArticlesResult): NewsSourceRow[] {
  const activeSources = resolveDefenseSources(result.articles.map((article) => article.sourceId))

  return activeSources.map((source) => ({
    id: source.id,
    name: source.name,
    category: source.category,
    source_badge: source.sourceBadge,
    feed_url: source.feedUrl,
    homepage_url: source.homepageUrl,
    weight: source.weight,
    last_ingested_at: result.fetchedAt,
  }))
}

function buildArticleRows(result: PullDefenseArticlesResult): IngestedArticleRow[] {
  return result.articles.map((article) => {
    const tags = classifyPulledArticle(article)

    return {
      source_id: article.sourceId,
      source_name: article.sourceName,
      source_category: article.sourceCategory,
      source_badge: article.sourceBadge,
      article_url: article.url,
      canonical_url: article.url,
      title: article.title,
      summary: article.summary || null,
      author: article.author || null,
      guid: article.guid || null,
      mission_tags: tags.missionTags,
      domain_tags: tags.domainTags,
      technology_tags: tags.technologyTags,
      track: tags.track,
      content_type: tags.contentType,
      high_impact: tags.highImpact,
      published_at: article.publishedAt || null,
      fetched_at: result.fetchedAt,
    }
  })
}

function buildLegacyArticleRows(result: PullDefenseArticlesResult): LegacyIngestedArticleRow[] {
  return result.articles.map((article) => ({
    source_id: article.sourceId,
    source_name: article.sourceName,
    source_category: article.sourceCategory,
    source_badge: article.sourceBadge,
    article_url: article.url,
    canonical_url: article.url,
    title: article.title,
    summary: article.summary || null,
    author: article.author || null,
    guid: article.guid || null,
    published_at: article.publishedAt || null,
    fetched_at: result.fetchedAt,
  }))
}

function missingTagColumnError(message: string) {
  const lowered = message.toLowerCase()
  return lowered.includes('could not find') && (lowered.includes('mission_tags') || lowered.includes('domain_tags') || lowered.includes('technology_tags') || lowered.includes('content_type') || lowered.includes('high_impact') || lowered.includes('track'))
}

function getUpsertErrorMessage(scope: string, message: string) {
  if (message.toLowerCase().includes('column') && message.toLowerCase().includes('does not exist')) {
    return `${scope} failed because ingestion schema is missing columns. Apply db/migrations/202602120003_article_tagging.sql first.`
  }

  return `${scope} failed: ${message}`
}

export function createSupabaseAdminClientFromEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for ingestion persistence.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function upsertPullResultToSupabase(
  supabase: SupabaseClient,
  result: PullDefenseArticlesResult
): Promise<PersistDefenseArticlesResult> {
  const sourceRows = buildSourceRows(result)

  if (sourceRows.length > 0) {
    const {error: sourceError} = await supabase.from('news_sources').upsert(sourceRows, {onConflict: 'id'})
    if (sourceError) {
      throw new Error(getUpsertErrorMessage('Upserting news_sources', sourceError.message))
    }
  }

  const articleRows = buildArticleRows(result)
  let usedLegacySchema = false

  for (const batch of chunk(articleRows, 300)) {
    const {error: articleError} = await supabase.from('ingested_articles').upsert(batch, {
      onConflict: 'canonical_url',
    })

    if (articleError) {
      if (missingTagColumnError(articleError.message)) {
        usedLegacySchema = true
        break
      }

      throw new Error(getUpsertErrorMessage('Upserting ingested_articles', articleError.message))
    }
  }

  if (usedLegacySchema) {
    const legacyRows = buildLegacyArticleRows(result)

    for (const batch of chunk(legacyRows, 300)) {
      const {error: articleError} = await supabase.from('ingested_articles').upsert(batch, {
        onConflict: 'canonical_url',
      })

      if (articleError) {
        throw new Error(getUpsertErrorMessage('Upserting ingested_articles (legacy schema)', articleError.message))
      }
    }
  }

  return {
    upsertedSourceCount: sourceRows.length,
    upsertedArticleCount: articleRows.length,
    usedLegacySchema,
  }
}
