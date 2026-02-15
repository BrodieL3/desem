import {createOptionalSupabaseServerClient} from '@/lib/supabase/server'
import {sanitizeHeadlineText, sanitizePlainText} from '@/lib/utils'

import type {ArticleCard, ArticleTopic, TopicSummary} from './types'

type IngestedArticleRow = {
  id: string
  title: string
  summary: string | null
  full_text_excerpt: string | null
  article_url: string
  source_id: string
  source_name: string
  source_badge: string
  published_at: string | null
  fetched_at: string
  lead_image_url: string | null
  canonical_image_url: string | null
  word_count: number | null
  reading_minutes: number | null
  content_fetch_status: string | null
}

type TopicRow = {
  id: string
  slug: string
  label: string
  topic_type: string
}

type ArticleTopicRow = {
  article_id: string
  topic_id: string
  confidence: number | null
  occurrences: number | null
  is_primary: boolean | null
  topics: TopicRow | TopicRow[] | null
}

type SourceRow = {
  id: string
  weight: number
}

type UserFollowRow = {
  topic_id: string
  topics: TopicRow | TopicRow[] | null
}

type CommentCountRow = {
  article_id: string
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function resolveTopicRow(value: ArticleTopicRow['topics']) {
  if (!value) {
    return null
  }

  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value
}

function asTopicType(value: string | null | undefined) {
  if (
    value === 'organization' ||
    value === 'program' ||
    value === 'technology' ||
    value === 'company' ||
    value === 'geography' ||
    value === 'acronym' ||
    value === 'person'
  ) {
    return value
  }

  return 'organization'
}

function recencyDecayScore(publishedAt: string | null, fetchedAt: string) {
  const reference = parseTimestamp(publishedAt ?? fetchedAt)

  if (!reference) {
    return 0
  }

  const ageHours = Math.max(0, (Date.now() - reference) / (1000 * 60 * 60))
  return Math.pow(0.5, ageHours / 36)
}

function scoreArticle(article: ArticleCard, followedTopicIds: Set<string>) {
  const primaryTopicMatches = article.topics.reduce(
    (count, topic) => count + Number(topic.isPrimary && followedTopicIds.has(topic.id)),
    0
  )

  const secondaryTopicMatches = article.topics.reduce(
    (count, topic) => count + Number(!topic.isPrimary && followedTopicIds.has(topic.id)),
    0
  )

  return primaryTopicMatches * 5 + secondaryTopicMatches * 2 + article.sourceWeight + recencyDecayScore(article.publishedAt, article.fetchedAt)
}

async function fetchSourceWeights() {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return new Map<string, number>()
  }

  const {data} = await supabase.from('news_sources').select('id, weight').returns<SourceRow[]>()
  return new Map((data ?? []).map((row) => [row.id, row.weight]))
}

async function fetchArticleTopicsByArticleId(articleIds: string[]) {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase || articleIds.length === 0) {
    return new Map<string, ArticleTopic[]>()
  }

  const {data} = await supabase
    .from('article_topics')
    .select('article_id, topic_id, confidence, occurrences, is_primary, topics(id, slug, label, topic_type)')
    .in('article_id', articleIds)
    .returns<ArticleTopicRow[]>()

  const grouped = new Map<string, ArticleTopic[]>()

  for (const row of data ?? []) {
    const topic = resolveTopicRow(row.topics)

    if (!topic) {
      continue
    }

    const articleTopics = grouped.get(row.article_id) ?? []

    articleTopics.push({
      id: row.topic_id,
      slug: topic.slug,
      label: topic.label,
      topicType: asTopicType(topic.topic_type),
      confidence: Number(row.confidence ?? 0.5),
      occurrences: Math.max(1, Number(row.occurrences ?? 1)),
      isPrimary: Boolean(row.is_primary),
    })

    grouped.set(row.article_id, articleTopics)
  }

  for (const [articleId, topics] of grouped.entries()) {
    grouped.set(
      articleId,
      topics.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) {
          return Number(b.isPrimary) - Number(a.isPrimary)
        }

        const confidenceDiff = b.confidence - a.confidence
        if (confidenceDiff !== 0) {
          return confidenceDiff
        }

        return b.occurrences - a.occurrences
      })
    )
  }

  return grouped
}

async function fetchCommentCountsByArticleId(articleIds: string[]) {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase || articleIds.length === 0) {
    return new Map<string, number>()
  }

  const {data} = await supabase
    .from('article_comments')
    .select('article_id')
    .in('article_id', articleIds)
    .returns<CommentCountRow[]>()

  const counts = new Map<string, number>()

  for (const row of data ?? []) {
    counts.set(row.article_id, (counts.get(row.article_id) ?? 0) + 1)
  }

  return counts
}

async function fetchFollowedTopics(userId?: string | null) {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase || !userId) {
    return {
      followedTopicIds: new Set<string>(),
      followedTopics: [] as TopicSummary[],
    }
  }

  const {data} = await supabase
    .from('user_topic_follows')
    .select('topic_id, topics(id, slug, label, topic_type)')
    .eq('user_id', userId)
    .returns<UserFollowRow[]>()

  const followedTopicIds = new Set<string>()
  const followedTopics: TopicSummary[] = []

  for (const row of data ?? []) {
    const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics

    if (!topic) {
      continue
    }

    followedTopicIds.add(topic.id)
    followedTopics.push({
      id: topic.id,
      slug: topic.slug,
      label: topic.label,
      topicType: asTopicType(topic.topic_type),
      articleCount: 0,
      followed: true,
    })
  }

  followedTopics.sort((a, b) => a.label.localeCompare(b.label))

  return {
    followedTopicIds,
    followedTopics,
  }
}

function mapRowsToArticleCards(input: {
  rows: IngestedArticleRow[]
  sourceWeights: Map<string, number>
  topicsByArticleId: Map<string, ArticleTopic[]>
  commentCountsByArticleId: Map<string, number>
  followedTopicIds: Set<string>
}) {
  return input.rows.map((row) => {
    const card: ArticleCard = {
      id: row.id,
      title: sanitizeHeadlineText(row.title),
      summary: row.summary ? sanitizePlainText(row.summary) : null,
      fullTextExcerpt: row.full_text_excerpt ? sanitizePlainText(row.full_text_excerpt) : null,
      articleUrl: row.article_url,
      sourceId: row.source_id,
      sourceName: row.source_name,
      sourceBadge: row.source_badge,
      sourceWeight: input.sourceWeights.get(row.source_id) ?? 1,
      publishedAt: row.published_at,
      fetchedAt: row.fetched_at,
      leadImageUrl: row.lead_image_url,
      canonicalImageUrl: row.canonical_image_url,
      wordCount: Math.max(0, Number(row.word_count ?? 0)),
      readingMinutes: Math.max(0, Number(row.reading_minutes ?? 0)),
      contentFetchStatus: row.content_fetch_status,
      commentCount: input.commentCountsByArticleId.get(row.id) ?? 0,
      topics: input.topicsByArticleId.get(row.id) ?? [],
      personalizationScore: 0,
    }

    if (input.followedTopicIds.size > 0) {
      card.personalizationScore = scoreArticle(card, input.followedTopicIds)
    }

    return card
  })
}

function sortArticlesForViewer(articles: ArticleCard[], followedTopicIds: Set<string>) {
  if (followedTopicIds.size === 0) {
    return [...articles].sort((a, b) => {
      const publishedDiff = parseTimestamp(b.publishedAt) - parseTimestamp(a.publishedAt)

      if (publishedDiff !== 0) {
        return publishedDiff
      }

      return b.sourceWeight - a.sourceWeight
    })
  }

  return [...articles].sort((a, b) => {
    const scoreDiff = b.personalizationScore - a.personalizationScore

    if (scoreDiff !== 0) {
      return scoreDiff
    }

    const publishedDiff = parseTimestamp(b.publishedAt) - parseTimestamp(a.publishedAt)

    if (publishedDiff !== 0) {
      return publishedDiff
    }

    return b.sourceWeight - a.sourceWeight
  })
}

function buildTrendingTopics(articles: ArticleCard[], followedTopicIds: Set<string>, limit = 10): TopicSummary[] {
  const counts = new Map<string, TopicSummary>()

  for (const article of articles) {
    for (const topic of article.topics) {
      const existing = counts.get(topic.id)

      if (!existing) {
        counts.set(topic.id, {
          id: topic.id,
          slug: topic.slug,
          label: topic.label,
          topicType: topic.topicType,
          articleCount: 1,
          followed: followedTopicIds.has(topic.id),
        })
        continue
      }

      existing.articleCount += 1
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.articleCount - a.articleCount || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function mergeFollowedTopicCounts(followedTopics: TopicSummary[], articles: ArticleCard[]) {
  const counts = new Map<string, number>()

  for (const article of articles) {
    for (const topic of article.topics) {
      counts.set(topic.id, (counts.get(topic.id) ?? 0) + 1)
    }
  }

  return followedTopics.map((topic) => ({
    ...topic,
    articleCount: counts.get(topic.id) ?? 0,
  }))
}

async function fetchBaseArticleRows(limit: number) {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return []
  }

  const {data} = await supabase
    .from('ingested_articles')
    .select(
      'id, title, summary, full_text_excerpt, article_url, source_id, source_name, source_badge, published_at, fetched_at, lead_image_url, canonical_image_url, word_count, reading_minutes, content_fetch_status'
    )
    .order('published_at', {ascending: false, nullsFirst: false})
    .order('fetched_at', {ascending: false})
    .limit(limit)
    .returns<IngestedArticleRow[]>()

  return data ?? []
}

export async function getHomeFeedData(userId?: string | null) {
  const [rows, sourceWeights, followState] = await Promise.all([
    fetchBaseArticleRows(160),
    fetchSourceWeights(),
    fetchFollowedTopics(userId),
  ])

  const articleIds = rows.map((row) => row.id)

  const [topicsByArticleId, commentCountsByArticleId] = await Promise.all([
    fetchArticleTopicsByArticleId(articleIds),
    fetchCommentCountsByArticleId(articleIds),
  ])

  const cards = mapRowsToArticleCards({
    rows,
    sourceWeights,
    topicsByArticleId,
    commentCountsByArticleId,
    followedTopicIds: followState.followedTopicIds,
  })

  const ranked = sortArticlesForViewer(cards, followState.followedTopicIds)
  const trendingTopics = buildTrendingTopics(ranked, followState.followedTopicIds, 12)
  const followedTopics = mergeFollowedTopicCounts(followState.followedTopics, ranked)

  const mostDiscussed = [...ranked]
    .filter((article) => article.commentCount > 0)
    .sort((a, b) => b.commentCount - a.commentCount || parseTimestamp(b.publishedAt) - parseTimestamp(a.publishedAt))
    .slice(0, 6)

  return {
    articles: ranked,
    trendingTopics,
    followedTopics,
    mostDiscussed,
  }
}

export async function getArticleById(id: string, userId?: string | null) {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return null
  }

  const {data} = await supabase
    .from('ingested_articles')
    .select(
      'id, title, summary, full_text_excerpt, article_url, source_id, source_name, source_badge, published_at, fetched_at, lead_image_url, canonical_image_url, word_count, reading_minutes, content_fetch_status, full_text'
    )
    .eq('id', id)
    .maybeSingle<IngestedArticleRow & {full_text: string | null}>()

  if (!data) {
    return null
  }

  const [sourceWeights, topicsByArticleId, commentCountsByArticleId, followState] = await Promise.all([
    fetchSourceWeights(),
    fetchArticleTopicsByArticleId([data.id]),
    fetchCommentCountsByArticleId([data.id]),
    fetchFollowedTopics(userId),
  ])

  const [article] = mapRowsToArticleCards({
    rows: [data],
    sourceWeights,
    topicsByArticleId,
    commentCountsByArticleId,
    followedTopicIds: followState.followedTopicIds,
  })

  if (!article) {
    return null
  }

  return {
    article,
    fullText: data.full_text,
    followedTopicIds: followState.followedTopicIds,
  }
}

export async function getTopicBySlug(slug: string) {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return null
  }

  const {data} = await supabase
    .from('topics')
    .select('id, slug, label, topic_type')
    .eq('slug', slug)
    .maybeSingle<TopicRow>()

  if (!data) {
    return null
  }

  return {
    id: data.id,
    slug: data.slug,
    label: data.label,
    topicType: asTopicType(data.topic_type),
  }
}

export async function getTopicPageData(topicSlug: string, userId?: string | null) {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return null
  }

  const topic = await getTopicBySlug(topicSlug)

  if (!topic) {
    return null
  }

  const [topicRows, followState] = await Promise.all([
    supabase
      .from('article_topics')
      .select('article_id, confidence, occurrences, is_primary')
      .eq('topic_id', topic.id)
      .order('confidence', {ascending: false})
      .limit(260)
      .returns<Array<{article_id: string; confidence: number | null; occurrences: number | null; is_primary: boolean | null}>>(),
    fetchFollowedTopics(userId),
  ])

  const articleIds = (topicRows.data ?? []).map((row) => row.article_id)

  if (articleIds.length === 0) {
    return {
      topic,
      isFollowed: followState.followedTopicIds.has(topic.id),
      articles: [],
      cooccurringTopics: [] as TopicSummary[],
    }
  }

  const [articleRows, sourceWeights, topicsByArticleId, commentCountsByArticleId] = await Promise.all([
    supabase
      .from('ingested_articles')
      .select(
        'id, title, summary, full_text_excerpt, article_url, source_id, source_name, source_badge, published_at, fetched_at, lead_image_url, canonical_image_url, word_count, reading_minutes, content_fetch_status'
      )
      .in('id', articleIds)
      .returns<IngestedArticleRow[]>(),
    fetchSourceWeights(),
    fetchArticleTopicsByArticleId(articleIds),
    fetchCommentCountsByArticleId(articleIds),
  ])

  const cards = mapRowsToArticleCards({
    rows: articleRows.data ?? [],
    sourceWeights,
    topicsByArticleId,
    commentCountsByArticleId,
    followedTopicIds: followState.followedTopicIds,
  })

  const sortedCards = sortArticlesForViewer(cards, new Set<string>())

  const {data: coTopicRows} = await supabase
    .from('article_topics')
    .select('topic_id, topics(id, slug, label, topic_type)')
    .in('article_id', articleIds)
    .neq('topic_id', topic.id)
    .returns<Array<{topic_id: string; topics: TopicRow | TopicRow[] | null}>>()

  const coTopicCounts = new Map<string, TopicSummary>()

  for (const row of coTopicRows ?? []) {
    const resolved = Array.isArray(row.topics) ? row.topics[0] : row.topics

    if (!resolved) {
      continue
    }

    const existing = coTopicCounts.get(row.topic_id)

    if (!existing) {
      coTopicCounts.set(row.topic_id, {
        id: resolved.id,
        slug: resolved.slug,
        label: resolved.label,
        topicType: asTopicType(resolved.topic_type),
        articleCount: 1,
        followed: followState.followedTopicIds.has(resolved.id),
      })
      continue
    }

    existing.articleCount += 1
  }

  return {
    topic,
    isFollowed: followState.followedTopicIds.has(topic.id),
    articles: sortedCards,
    cooccurringTopics: [...coTopicCounts.values()]
      .sort((a, b) => b.articleCount - a.articleCount || a.label.localeCompare(b.label))
      .slice(0, 14),
  }
}

export async function getArticleListForApi(options?: {
  query?: string
  topicSlug?: string
  limit?: number
  offset?: number
  userId?: string | null
}) {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return [] as ArticleCard[]
  }

  const limit = Math.max(1, Math.min(options?.limit ?? 30, 100))
  const offset = Math.max(0, options?.offset ?? 0)
  const query = options?.query?.trim()
  const topicSlug = options?.topicSlug?.trim()

  let queryBuilder = supabase
    .from('ingested_articles')
    .select(
      'id, title, summary, full_text_excerpt, article_url, source_id, source_name, source_badge, published_at, fetched_at, lead_image_url, canonical_image_url, word_count, reading_minutes, content_fetch_status'
    )

  if (query) {
    queryBuilder = queryBuilder.textSearch('search_document', query, {
      config: 'english',
      type: 'websearch',
    })
  }

  if (topicSlug) {
    const topic = await getTopicBySlug(topicSlug)

    if (!topic) {
      return []
    }

    const {data: matchingRows} = await supabase
      .from('article_topics')
      .select('article_id')
      .eq('topic_id', topic.id)
      .limit(1500)
      .returns<Array<{article_id: string}>>()

    const articleIds = (matchingRows ?? []).map((row) => row.article_id)

    if (articleIds.length === 0) {
      return []
    }

    queryBuilder = queryBuilder.in('id', articleIds)
  }

  const fetchSize = query || topicSlug ? offset + limit : Math.max(offset + limit, 180)

  const {data: rows} = await queryBuilder
    .order('published_at', {ascending: false, nullsFirst: false})
    .order('fetched_at', {ascending: false})
    .limit(fetchSize)
    .returns<IngestedArticleRow[]>()

  const safeRows = rows ?? []
  const articleIds = safeRows.map((row) => row.id)

  const [sourceWeights, topicsByArticleId, commentCountsByArticleId, followState] = await Promise.all([
    fetchSourceWeights(),
    fetchArticleTopicsByArticleId(articleIds),
    fetchCommentCountsByArticleId(articleIds),
    fetchFollowedTopics(options?.userId),
  ])

  const mapped = mapRowsToArticleCards({
    rows: safeRows,
    sourceWeights,
    topicsByArticleId,
    commentCountsByArticleId,
    followedTopicIds: followState.followedTopicIds,
  })

  const ranked = !query && !topicSlug ? sortArticlesForViewer(mapped, followState.followedTopicIds) : sortArticlesForViewer(mapped, new Set())

  return ranked.slice(offset, offset + limit)
}
