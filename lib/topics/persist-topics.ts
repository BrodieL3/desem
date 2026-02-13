import type {SupabaseClient} from '@supabase/supabase-js'

import {extractTopicsFromArticle} from './extract-topics'
import type {TopicType} from './taxonomy'

type PersistableArticle = {
  id: string
  title: string
  summary: string | null
  full_text: string | null
}

type TopicLookupRow = {
  id: string
  slug: string
  label: string
  topic_type: TopicType
}

function roundConfidence(value: number) {
  return Math.min(0.999, Math.max(0, Number(value.toFixed(3))))
}

export async function persistExtractedTopicsForArticle(
  supabase: SupabaseClient,
  article: PersistableArticle
): Promise<{topicCount: number}> {
  const extracted = extractTopicsFromArticle({
    title: article.title,
    summary: article.summary,
    fullText: article.full_text,
  })

  await supabase.from('article_topics').delete().eq('article_id', article.id)

  if (extracted.length === 0) {
    return {topicCount: 0}
  }

  const uniqueBySlug = new Map<string, {slug: string; label: string; topic_type: TopicType}>()

  for (const topic of extracted) {
    uniqueBySlug.set(topic.slug, {
      slug: topic.slug,
      label: topic.label,
      topic_type: topic.topicType,
    })
  }

  const topicsToUpsert = [...uniqueBySlug.values()]

  const {error: upsertTopicsError} = await supabase.from('topics').upsert(topicsToUpsert, {
    onConflict: 'slug',
  })

  if (upsertTopicsError) {
    throw new Error(`Unable to upsert topics: ${upsertTopicsError.message}`)
  }

  const slugs = topicsToUpsert.map((topic) => topic.slug)

  const {data: topicRows, error: lookupError} = await supabase
    .from('topics')
    .select('id, slug, label, topic_type')
    .in('slug', slugs)
    .returns<TopicLookupRow[]>()

  if (lookupError || !topicRows) {
    throw new Error(`Unable to resolve topic ids: ${lookupError?.message ?? 'No topic rows returned.'}`)
  }

  const topicIdBySlug = new Map(topicRows.map((row) => [row.slug, row.id]))

  const articleTopicRows = extracted
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

  if (articleTopicRows.length === 0) {
    return {topicCount: 0}
  }

  const {error: insertError} = await supabase.from('article_topics').insert(articleTopicRows)

  if (insertError) {
    throw new Error(`Unable to insert article topics: ${insertError.message}`)
  }

  return {topicCount: articleTopicRows.length}
}
