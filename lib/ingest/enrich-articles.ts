import type {SupabaseClient} from '@supabase/supabase-js'

import {persistExtractedTopicsForArticle} from '@/lib/topics/persist-topics'

import {extractArticleContentFromUrl} from './extract-article-content'

export type EnrichmentArticleRow = {
  id: string
  article_url: string
  title: string
  summary: string | null
  full_text: string | null
  content_fetch_status?: string | null
  published_at: string | null
  fetched_at: string
}

export type ContentEnrichmentResult = {
  processed: number
  fetched: number
  failed: number
}

export type TopicEnrichmentResult = {
  processed: number
  withTopics: number
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  const boundedLimit = Math.max(1, limit)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      await task(items[index])
    }
  }

  const workers = Array.from({length: Math.min(items.length, boundedLimit)}, () => worker())
  await Promise.all(workers)
}

export async function getArticlesByFetchedAt(
  supabase: SupabaseClient,
  fetchedAt: string,
  limit = 900
): Promise<EnrichmentArticleRow[]> {
  const {data, error} = await supabase
    .from('ingested_articles')
    .select('id, article_url, title, summary, full_text, content_fetch_status, published_at, fetched_at')
    .eq('fetched_at', fetchedAt)
    .order('published_at', {ascending: false, nullsFirst: false})
    .limit(limit)
    .returns<EnrichmentArticleRow[]>()

  if (error || !data) {
    throw new Error(`Unable to fetch recently ingested articles: ${error?.message ?? 'No data returned.'}`)
  }

  return data
}

export async function getArticlesNeedingContent(
  supabase: SupabaseClient,
  limit = 1200
): Promise<EnrichmentArticleRow[]> {
  const {data, error} = await supabase
    .from('ingested_articles')
    .select('id, article_url, title, summary, full_text, content_fetch_status, published_at, fetched_at')
    .or('content_fetch_status.is.null,content_fetch_status.neq.fetched')
    .order('published_at', {ascending: false, nullsFirst: false})
    .limit(limit)
    .returns<EnrichmentArticleRow[]>()

  if (error || !data) {
    throw new Error(`Unable to fetch articles needing content enrichment: ${error?.message ?? 'No data returned.'}`)
  }

  return data
}

export async function getArticlesMissingTopics(
  supabase: SupabaseClient,
  limit = 1500
): Promise<EnrichmentArticleRow[]> {
  const {data: articles, error: articlesError} = await supabase
    .from('ingested_articles')
    .select('id, article_url, title, summary, full_text, content_fetch_status, published_at, fetched_at')
    .eq('content_fetch_status', 'fetched')
    .order('published_at', {ascending: false, nullsFirst: false})
    .limit(limit)
    .returns<EnrichmentArticleRow[]>()

  if (articlesError || !articles) {
    throw new Error(`Unable to fetch enriched articles for topic backfill: ${articlesError?.message ?? 'No data returned.'}`)
  }

  if (articles.length === 0) {
    return []
  }

  const articleIds = articles.map((article) => article.id)
  const {data: topicRows, error: topicError} = await supabase
    .from('article_topics')
    .select('article_id')
    .in('article_id', articleIds)
    .returns<Array<{article_id: string}>>()

  if (topicError) {
    throw new Error(`Unable to fetch existing article topics: ${topicError.message}`)
  }

  const withTopics = new Set((topicRows ?? []).map((row) => row.article_id))

  return articles.filter((article) => !withTopics.has(article.id))
}

export async function enrichArticleContentBatch(
  supabase: SupabaseClient,
  articles: EnrichmentArticleRow[],
  options?: {
    concurrency?: number
    timeoutMs?: number
  }
): Promise<ContentEnrichmentResult> {
  const result: ContentEnrichmentResult = {
    processed: articles.length,
    fetched: 0,
    failed: 0,
  }

  await runWithConcurrency(articles, options?.concurrency ?? 5, async (article) => {
    const extraction = await extractArticleContentFromUrl(article.article_url, {
      timeoutMs: options?.timeoutMs ?? 15000,
    })

    const {error} = await supabase
      .from('ingested_articles')
      .update({
        full_text: extraction.fullText,
        full_text_excerpt: extraction.fullTextExcerpt,
        lead_image_url: extraction.leadImageUrl,
        canonical_image_url: extraction.canonicalImageUrl,
        content_fetch_status: extraction.contentFetchStatus,
        content_fetch_error: extraction.contentFetchError,
        content_fetched_at: extraction.contentFetchedAt,
        word_count: extraction.wordCount,
        reading_minutes: extraction.readingMinutes,
      })
      .eq('id', article.id)

    if (error) {
      result.failed += 1
      return
    }

    if (extraction.contentFetchStatus === 'fetched') {
      result.fetched += 1
    } else {
      result.failed += 1
    }
  })

  return result
}

export async function enrichArticleTopicsBatch(
  supabase: SupabaseClient,
  articles: EnrichmentArticleRow[],
  options?: {
    concurrency?: number
  }
): Promise<TopicEnrichmentResult> {
  const result: TopicEnrichmentResult = {
    processed: articles.length,
    withTopics: 0,
  }

  await runWithConcurrency(articles, options?.concurrency ?? 5, async (article) => {
    const persisted = await persistExtractedTopicsForArticle(supabase, {
      id: article.id,
      title: article.title,
      summary: article.summary,
      full_text: article.full_text,
    })

    if (persisted.topicCount > 0) {
      result.withTopics += 1
    }
  })

  return result
}
