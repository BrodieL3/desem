import type {SupabaseClient} from '@supabase/supabase-js'

import {createSupabaseAdminClientFromEnv as createAdminClient} from '@/lib/supabase/admin'

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
  quality_tier: string
  bias: string
  update_cadence: string
  story_role: string
  topic_focus: string[]
  last_ingested_at: string
}

type LegacyNewsSourceRow = Omit<NewsSourceRow, 'quality_tier' | 'bias' | 'update_cadence' | 'story_role' | 'topic_focus'>

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
  lead_image_url?: string
  canonical_image_url?: string
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
    quality_tier: source.qualityTier,
    bias: source.bias,
    update_cadence: source.updateCadence,
    story_role: source.storyRole,
    topic_focus: source.topicFocus,
    last_ingested_at: result.fetchedAt,
  }))
}

function buildArticleRows(result: PullDefenseArticlesResult): IngestedArticleRow[] {
  return result.articles.map((article) => {
    const imageUrl = article.imageUrl?.trim() || ''

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
      ...(imageUrl ? {lead_image_url: imageUrl, canonical_image_url: imageUrl} : {}),
      published_at: article.publishedAt || null,
      fetched_at: result.fetchedAt,
    }
  })
}

function getUpsertErrorMessage(scope: string, message: string) {
  return `${scope} failed: ${message}`
}

function stripSourceCurationColumns(rows: NewsSourceRow[]): LegacyNewsSourceRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    source_badge: row.source_badge,
    feed_url: row.feed_url,
    homepage_url: row.homepage_url,
    weight: row.weight,
    last_ingested_at: row.last_ingested_at,
  }))
}

function isSourceCurationSchemaError(message: string) {
  return /(quality_tier|bias|update_cadence|story_role|topic_focus)/i.test(message)
}

export function createSupabaseAdminClientFromEnv() {
  return createAdminClient()
}

export async function upsertPullResultToSupabase(
  supabase: SupabaseClient,
  result: PullDefenseArticlesResult
): Promise<PersistDefenseArticlesResult> {
  const sourceRows = buildSourceRows(result)
  let usedLegacySchema = false

  if (sourceRows.length > 0) {
    const {error: sourceError} = await supabase.from('news_sources').upsert(sourceRows, {onConflict: 'id'})

    if (sourceError && isSourceCurationSchemaError(sourceError.message)) {
      const legacyRows = stripSourceCurationColumns(sourceRows)
      const {error: legacyError} = await supabase.from('news_sources').upsert(legacyRows, {onConflict: 'id'})

      if (legacyError) {
        throw new Error(getUpsertErrorMessage('Upserting news_sources (legacy schema fallback)', legacyError.message))
      }

      usedLegacySchema = true
    } else if (sourceError) {
      throw new Error(getUpsertErrorMessage('Upserting news_sources', sourceError.message))
    }
  }

  const articleRows = buildArticleRows(result)

  for (const batch of chunk(articleRows, 300)) {
    const {error: articleError} = await supabase.from('ingested_articles').upsert(batch, {
      onConflict: 'canonical_url',
    })

    if (articleError) {
      throw new Error(getUpsertErrorMessage('Upserting ingested_articles', articleError.message))
    }
  }

  return {
    upsertedSourceCount: sourceRows.length,
    upsertedArticleCount: articleRows.length,
    usedLegacySchema,
  }
}
