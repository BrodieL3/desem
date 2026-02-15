import type {SupabaseClient} from '@supabase/supabase-js'

import {extractTopicsFromArticle} from './extract-topics'
import {curatedTopicTaxonomy, type TopicType} from './taxonomy'

type PersistableArticle = {
  id: string
  title: string
  summary: string | null
  full_text: string | null
  source_id?: string | null
  source_name?: string | null
  source_category?: string | null
}

type TopicLookupRow = {
  id: string
  slug: string
  label: string
  topic_type: TopicType
}

const retryableDatabaseErrorPatterns = [
  /deadlock detected/i,
  /could not serialize access/i,
  /canceling statement due to lock timeout/i,
  /lock not available/i,
]

const taxonomyTopicSlugs = new Set(curatedTopicTaxonomy.map((topic) => topic.slug))

function roundConfidence(value: number) {
  return Math.min(0.999, Math.max(0, Number(value.toFixed(3))))
}

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isRetryableDatabaseError(error: unknown) {
  const message = asErrorMessage(error)
  return retryableDatabaseErrorPatterns.some((pattern) => pattern.test(message))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withDatabaseRetry<T>(operation: string, task: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let attempt = 0
  let lastError: unknown

  while (attempt < maxAttempts) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      attempt += 1

      if (!isRetryableDatabaseError(error) || attempt >= maxAttempts) {
        throw new Error(`${operation}: ${asErrorMessage(error)}`)
      }

      await sleep(80 * attempt)
    }
  }

  throw new Error(`${operation}: ${asErrorMessage(lastError)}`)
}

export async function persistExtractedTopicsForArticle(
  supabase: SupabaseClient,
  article: PersistableArticle
): Promise<{topicCount: number}> {
  const extracted = extractTopicsFromArticle({
    title: article.title,
    summary: article.summary,
    fullText: article.full_text,
    sourceId: article.source_id,
    sourceName: article.source_name,
    sourceCategory: article.source_category,
  })
  const persistableTopics = extracted.filter((topic) => taxonomyTopicSlugs.has(topic.slug))

  await withDatabaseRetry('Unable to clear existing article topics', async () => {
    const {error} = await supabase.from('article_topics').delete().eq('article_id', article.id)

    if (error) {
      throw new Error(error.message)
    }
  })

  if (persistableTopics.length === 0) {
    return {topicCount: 0}
  }

  const uniqueBySlug = new Map<string, {slug: string; label: string; topic_type: TopicType}>()

  for (const topic of persistableTopics) {
    uniqueBySlug.set(topic.slug, {
      slug: topic.slug,
      label: topic.label,
      topic_type: topic.topicType,
    })
  }

  const topicsToUpsert = [...uniqueBySlug.values()].sort((left, right) => left.slug.localeCompare(right.slug))

  await withDatabaseRetry('Unable to upsert topics', async () => {
    const {error: upsertTopicsError} = await supabase.from('topics').upsert(topicsToUpsert, {
      onConflict: 'slug',
    })

    if (upsertTopicsError) {
      throw new Error(upsertTopicsError.message)
    }
  })

  const slugs = topicsToUpsert.map((topic) => topic.slug)
  const topicRows = await withDatabaseRetry('Unable to resolve topic ids', async () => {
    const {data, error: lookupError} = await supabase
      .from('topics')
      .select('id, slug, label, topic_type')
      .in('slug', slugs)
      .returns<TopicLookupRow[]>()

    if (lookupError || !data) {
      throw new Error(lookupError?.message ?? 'No topic rows returned.')
    }

    return data
  })

  const topicIdBySlug = new Map(topicRows.map((row) => [row.slug, row.id]))

  const articleTopicRows = persistableTopics
    .map((topic) => {
      const topicId = topicIdBySlug.get(topic.slug)

      if (!topicId) {
        return null
      }

      return {
        article_id: article.id,
        topic_id: topicId,
        confidence: roundConfidence(topic.confidence),
        occurrences: Math.max(1, topic.occurrences),
        is_primary: topic.isPrimary,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => left.topic_id.localeCompare(right.topic_id))

  if (articleTopicRows.length === 0) {
    return {topicCount: 0}
  }

  await withDatabaseRetry('Unable to insert article topics', async () => {
    const {error: insertError} = await supabase.from('article_topics').insert(articleTopicRows)

    if (insertError) {
      throw new Error(insertError.message)
    }
  })

  return {topicCount: articleTopicRows.length}
}
