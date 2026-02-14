import {NextResponse} from 'next/server'

import {buildStoryClusters} from '@/lib/editorial/clustering'
import {defaultCongestionRules} from '@/lib/editorial/congestion'
import {isEditorialFocusMatch} from '@/lib/editorial/focus'
import {syncSemaphorSecurityNewsItemsToSanity} from '@/lib/editorial/semaphor-sync'
import type {EditorialArticle, EditorialTopic, StoryCluster} from '@/lib/editorial/types'
import {
  enrichArticleContentBatch,
  enrichArticleTopicsBatch,
  getArticlesByFetchedAt,
} from '@/lib/ingest/enrich-articles'
import {pullDefenseArticles} from '@/lib/ingest/pull-defense-articles'
import {createSupabaseAdminClientFromEnv, upsertPullResultToSupabase} from '@/lib/ingest/persist'
import {createSanityTokenWriteClientFromEnv, createSanityWriteClientFromEnv} from '@/lib/sanity/client'
import {syncEditorialDrafts} from '@/lib/sanity/sync'
import type {TopicType} from '@/lib/topics/taxonomy'

export const dynamic = 'force-dynamic'

type EditorialArticleRow = {
  id: string
  title: string
  summary: string | null
  full_text: string | null
  full_text_excerpt: string | null
  article_url: string
  source_id: string
  source_name: string
  source_category: string
  source_badge: string
  published_at: string | null
  fetched_at: string
  word_count: number | null
  reading_minutes: number | null
  content_fetch_status: string | null
  lead_image_url: string | null
  canonical_image_url: string | null
}

type EditorialTopicRow = {
  article_id: string
  is_primary: boolean | null
  topics:
    | {
        id: string
        slug: string
        label: string
        topic_type: string | null
      }
    | Array<{
        id: string
        slug: string
        label: string
        topic_type: string | null
      }>
    | null
}

type StoryClusterRow = {
  id: string
  cluster_key: string
}

function authorizeCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return true
  }

  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

function asBoolean(value: string | undefined, fallback = true) {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function mergeStoryClustersByKey(clusters: StoryCluster[]) {
  const mergedByKey = new Map<
    string,
    {
      cluster: StoryCluster
      memberByArticleId: Map<
        string,
        {
          article: StoryCluster['members'][number]['article']
          similarity: number
          isRepresentative: boolean
        }
      >
    }
  >()
  const duplicateKeyCounts = new Map<string, number>()

  for (const cluster of clusters) {
    const existing = mergedByKey.get(cluster.clusterKey)

    if (!existing) {
      const memberByArticleId = new Map(
        cluster.members.map((member) => [
          member.article.id,
          {
            article: member.article,
            similarity: member.similarity,
            isRepresentative: member.isRepresentative,
          },
        ])
      )

      mergedByKey.set(cluster.clusterKey, {
        cluster: {
          ...cluster,
          members: cluster.members.map((member) => ({
            article: member.article,
            similarity: member.similarity,
            isRepresentative: member.isRepresentative,
          })),
        },
        memberByArticleId,
      })
      continue
    }

    duplicateKeyCounts.set(cluster.clusterKey, (duplicateKeyCounts.get(cluster.clusterKey) ?? 0) + 1)

    for (const member of cluster.members) {
      const current = existing.memberByArticleId.get(member.article.id)

      if (!current) {
        existing.memberByArticleId.set(member.article.id, {
          article: member.article,
          similarity: member.similarity,
          isRepresentative: member.isRepresentative,
        })
        continue
      }

      existing.memberByArticleId.set(member.article.id, {
        article: current.article,
        similarity: Math.max(current.similarity, member.similarity),
        isRepresentative: current.isRepresentative || member.isRepresentative,
      })
    }

    if (!existing.cluster.topicLabel && cluster.topicLabel) {
      existing.cluster.topicLabel = cluster.topicLabel
    }
  }

  const dedupedClusters: StoryCluster[] = []

  for (const {cluster, memberByArticleId} of mergedByKey.values()) {
    const members = [...memberByArticleId.values()].map((member) => ({
      article: member.article,
      similarity: Number(member.similarity.toFixed(3)),
      isRepresentative: member.isRepresentative,
    }))

    const representativeFromMembers = members.find((member) => member.isRepresentative)?.article
    const representativeArticle = representativeFromMembers ?? cluster.representativeArticle
    const hasRepresentative = members.some((member) => member.article.id === representativeArticle.id)

    if (!hasRepresentative) {
      members.push({
        article: representativeArticle,
        similarity: 1,
        isRepresentative: true,
      })
    }

    dedupedClusters.push({
      ...cluster,
      representativeArticle,
      members,
    })
  }

  return {
    clusters: dedupedClusters,
    duplicateKeys: [...duplicateKeyCounts.keys()],
    duplicateRowCount: [...duplicateKeyCounts.values()].reduce((sum, value) => sum + value, 0),
  }
}

function asTopicType(value: string | null | undefined): TopicType {
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

function resolveTopic(value: EditorialTopicRow['topics']) {
  if (!value) {
    return null
  }

  return Array.isArray(value) ? value[0] ?? null : value
}

function filterFocusedEditorialArticles(articles: EditorialArticle[]) {
  const focused = articles.filter((article) =>
    isEditorialFocusMatch({
      title: article.title,
      summary: article.summary ?? article.fullTextExcerpt,
      topicLabel: article.topics[0]?.label ?? null,
      topics: article.topics,
    })
  )

  return {
    focused,
    focusedCount: focused.length,
    nonFocusedCount: Math.max(0, articles.length - focused.length),
  }
}

async function fetchRecentEditorialArticles(
  supabase: ReturnType<typeof createSupabaseAdminClientFromEnv>,
  options?: {
    windowHours?: number
    limit?: number
  }
): Promise<EditorialArticle[]> {
  const windowHours = options?.windowHours ?? 96
  const limit = options?.limit ?? 2500
  const minFetchedAt = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

  const {data: rows, error: rowError} = await supabase
    .from('ingested_articles')
    .select(
      'id, title, summary, full_text, full_text_excerpt, article_url, source_id, source_name, source_category, source_badge, published_at, fetched_at, word_count, reading_minutes, content_fetch_status, lead_image_url, canonical_image_url'
    )
    .gte('fetched_at', minFetchedAt)
    .order('published_at', {ascending: false, nullsFirst: false})
    .order('fetched_at', {ascending: false})
    .limit(limit)
    .returns<EditorialArticleRow[]>()

  if (rowError) {
    throw new Error(`Unable to fetch recent editorial rows: ${rowError.message}`)
  }

  const safeRows = rows ?? []
  const articleIds = safeRows.map((row) => row.id)

  if (articleIds.length === 0) {
    return []
  }

  const {data: topicRows, error: topicError} = await supabase
    .from('article_topics')
    .select('article_id, is_primary, topics(id, slug, label, topic_type)')
    .in('article_id', articleIds)
    .returns<EditorialTopicRow[]>()

  if (topicError) {
    throw new Error(`Unable to fetch editorial topics: ${topicError.message}`)
  }

  const topicsByArticleId = new Map<string, EditorialTopic[]>()

  for (const topicRow of topicRows ?? []) {
    const topic = resolveTopic(topicRow.topics)

    if (!topic) {
      continue
    }

    const topics = topicsByArticleId.get(topicRow.article_id) ?? []

    topics.push({
      id: topic.id,
      slug: topic.slug,
      label: topic.label,
      topicType: asTopicType(topic.topic_type),
      isPrimary: Boolean(topicRow.is_primary),
    })

    topicsByArticleId.set(topicRow.article_id, topics)
  }

  return safeRows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    fullText: row.full_text,
    fullTextExcerpt: row.full_text_excerpt,
    articleUrl: row.article_url,
    sourceId: row.source_id,
    sourceName: row.source_name,
    sourceCategory: row.source_category,
    sourceBadge: row.source_badge,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    wordCount: Math.max(0, Number(row.word_count ?? 0)),
    readingMinutes: Math.max(0, Number(row.reading_minutes ?? 0)),
    contentFetchStatus: row.content_fetch_status,
    leadImageUrl: row.lead_image_url,
    canonicalImageUrl: row.canonical_image_url,
    topics: topicsByArticleId.get(row.id) ?? [],
  }))
}

async function beginEditorialRun(
  supabase: ReturnType<typeof createSupabaseAdminClientFromEnv>,
  fetchedAt: string
): Promise<string> {
  const {data, error} = await supabase
    .from('editorial_generation_runs')
    .insert({
      trigger_source: 'cron',
      fetched_at: fetchedAt,
      status: 'running',
    })
    .select('id')
    .single<{id: string}>()

  if (error || !data) {
    throw new Error(`Unable to create editorial_generation_runs row: ${error?.message ?? 'No row returned.'}`)
  }

  return data.id
}

async function completeEditorialRun(
  supabase: ReturnType<typeof createSupabaseAdminClientFromEnv>,
  runId: string,
  payload: {
    status: 'succeeded' | 'failed'
    articleCount: number
    clusterCount: number
    transformAttemptedCount: number
    transformSuccessCount: number
    transformFailedCount: number
    errorMessage?: string | null
  }
) {
  const {error} = await supabase
    .from('editorial_generation_runs')
    .update({
      status: payload.status,
      article_count: payload.articleCount,
      cluster_count: payload.clusterCount,
      transform_attempted_count: payload.transformAttemptedCount,
      transform_success_count: payload.transformSuccessCount,
      transform_failed_count: payload.transformFailedCount,
      error_message: payload.errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)

  if (error) {
    throw new Error(`Unable to finalize editorial_generation_runs row: ${error.message}`)
  }
}

async function persistStoryClusters(input: {
  supabase: ReturnType<typeof createSupabaseAdminClientFromEnv>
  runId: string
  generatedAt: Date
  clusters: StoryCluster[]
  syncedClusters: Awaited<ReturnType<typeof syncEditorialDrafts>>['clusters']
}) {
  const merged = mergeStoryClustersByKey(input.clusters)

  if (merged.duplicateKeys.length > 0) {
    console.warn(
      `[editorial] Collapsed duplicate cluster keys before story_clusters upsert (duplicates=${merged.duplicateRowCount}, keys=${merged.duplicateKeys.join(', ')})`
    )
  }

  const syncedByKey = new Map(input.syncedClusters.map((cluster) => [cluster.clusterKey, cluster]))

  const rows = merged.clusters.map((cluster) => {
    const synced = syncedByKey.get(cluster.clusterKey)

    if (!synced) {
      throw new Error(`Missing synced cluster metadata for key ${cluster.clusterKey}`)
    }

    return {
      cluster_key: cluster.clusterKey,
      representative_article_id: synced.representativeArticleId,
      headline: synced.headline,
      topic_label: synced.topicLabel,
      article_count_24h: synced.articleCount24h,
      unique_sources_24h: synced.uniqueSources24h,
      congestion_score: synced.congestionScore,
      is_congested: synced.isCongested,
      transform_attempted: synced.transformAttempted,
      transform_status: synced.transformStatus,
      generation_mode: synced.generationMode,
      review_status: synced.reviewStatus,
      last_generated_run_id: input.runId,
      last_generated_at: input.generatedAt.toISOString(),
    }
  })

  if (rows.length === 0) {
    return
  }

  const {data: upsertedRows, error: upsertError} = await input.supabase
    .from('story_clusters')
    .upsert(rows, {
      onConflict: 'cluster_key',
    })
    .select('id, cluster_key')
    .returns<StoryClusterRow[]>()

  if (upsertError) {
    throw new Error(`Unable to upsert story_clusters rows: ${upsertError.message}`)
  }

  const clusterIds = (upsertedRows ?? []).map((row) => row.id)

  if (clusterIds.length === 0) {
    return
  }

  const {error: deleteMembersError} = await input.supabase.from('cluster_members').delete().in('cluster_id', clusterIds)

  if (deleteMembersError) {
    throw new Error(`Unable to clear previous cluster_members rows: ${deleteMembersError.message}`)
  }

  const clusterIdByKey = new Map((upsertedRows ?? []).map((row) => [row.cluster_key, row.id]))

  const memberRows: Array<{
    cluster_id: string
    article_id: string
    similarity: number
    is_representative: boolean
  }> = []
  const memberRowByKey = new Map<
    string,
    {
      cluster_id: string
      article_id: string
      similarity: number
      is_representative: boolean
    }
  >()

  for (const cluster of merged.clusters) {
    const clusterId = clusterIdByKey.get(cluster.clusterKey)

    if (!clusterId) {
      continue
    }

    for (const member of cluster.members) {
      const memberKey = `${clusterId}:${member.article.id}`
      const current = memberRowByKey.get(memberKey)

      if (!current) {
        memberRowByKey.set(memberKey, {
          cluster_id: clusterId,
          article_id: member.article.id,
          similarity: Number(member.similarity.toFixed(3)),
          is_representative: member.isRepresentative,
        })
        continue
      }

      memberRowByKey.set(memberKey, {
        cluster_id: clusterId,
        article_id: member.article.id,
        similarity: Math.max(current.similarity, Number(member.similarity.toFixed(3))),
        is_representative: current.is_representative || member.isRepresentative,
      })
    }
  }

  memberRows.push(...memberRowByKey.values())

  for (const memberChunk of chunk(memberRows, 400)) {
    const {error: insertMembersError} = await input.supabase.from('cluster_members').insert(memberChunk)

    if (insertMembersError) {
      throw new Error(`Unable to upsert cluster_members rows: ${insertMembersError.message}`)
    }
  }
}

async function runIngestion(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  try {
    const pullSinceHours = parsePositiveInt(process.env.INGEST_PULL_SINCE_HOURS, 72, 12, 168)
    const pullMaxPerSource = parsePositiveInt(process.env.INGEST_PULL_MAX_PER_SOURCE, 80, 10, 200)
    const pullLimit = parsePositiveInt(process.env.INGEST_PULL_LIMIT, 1600, 100, 4000)
    const editorialWindowHours = parsePositiveInt(process.env.EDITORIAL_WINDOW_HOURS, 96, 24, 336)
    const editorialArticleLimit = parsePositiveInt(process.env.EDITORIAL_ARTICLE_LIMIT, 2500, 200, 5000)
    const focusFilterEnabled = asBoolean(process.env.EDITORIAL_FOCUS_FILTER_ENABLED, true)

    const pullResult = await pullDefenseArticles({
      sinceHours: pullSinceHours,
      maxPerSource: pullMaxPerSource,
      limit: pullLimit,
      timeoutMs: 20000,
    })

    const supabase = createSupabaseAdminClientFromEnv()
    const persisted = await upsertPullResultToSupabase(supabase, pullResult)

    const recentlyIngested = await getArticlesByFetchedAt(supabase, pullResult.fetchedAt)

    const contentResult = await enrichArticleContentBatch(supabase, recentlyIngested, {
      concurrency: 5,
      timeoutMs: 15000,
    })

    const refreshedRows = await getArticlesByFetchedAt(supabase, pullResult.fetchedAt)

    const topicResult = await enrichArticleTopicsBatch(supabase, refreshedRows, {
      concurrency: 2,
    })

    const editorialEnabled = asBoolean(process.env.EDITORIAL_PIPELINE_ENABLED, true)

    const editorial: {
      enabled: boolean
      runId: string | null
      articleCount: number
      clusterCount: number
      newsItemCount: number
      digestCount: number
      transformAttemptedCount: number
      transformSucceededCount: number
      transformFailedCount: number
      focusFilterEnabled: boolean
      focusedArticleCount: number
      excludedArticleCount: number
      error: string | null
    } = {
      enabled: editorialEnabled,
      runId: null,
      articleCount: 0,
      clusterCount: 0,
      newsItemCount: 0,
      digestCount: 0,
      transformAttemptedCount: 0,
      transformSucceededCount: 0,
      transformFailedCount: 0,
      focusFilterEnabled,
      focusedArticleCount: 0,
      excludedArticleCount: 0,
      error: null,
    }

    if (editorialEnabled) {
      const generatedAt = new Date()
      const runId = await beginEditorialRun(supabase, pullResult.fetchedAt)
      editorial.runId = runId

      try {
        const allEditorialArticles = await fetchRecentEditorialArticles(supabase, {
          windowHours: editorialWindowHours,
          limit: editorialArticleLimit,
        })

        const focusFiltered = filterFocusedEditorialArticles(allEditorialArticles)
        const editorialArticles =
          focusFilterEnabled && focusFiltered.focusedCount > 0 ? focusFiltered.focused : allEditorialArticles

        editorial.articleCount = editorialArticles.length
        editorial.focusedArticleCount = focusFiltered.focusedCount
        editorial.excludedArticleCount = focusFiltered.nonFocusedCount

        const clusters = await buildStoryClusters(editorialArticles, {
          threshold: Number(process.env.EDITORIAL_CLUSTER_THRESHOLD ?? '0.72'),
          windowHours: editorialWindowHours,
          openAIApiKey: asBoolean(process.env.EDITORIAL_EMBEDDINGS_ENABLED, true)
            ? process.env.OPENAI_API_KEY
            : undefined,
          embeddingModel: process.env.EDITORIAL_EMBEDDING_MODEL ?? 'text-embedding-3-small',
          maxEmbeddingArticles: parsePositiveInt(process.env.EDITORIAL_MAX_EMBEDDING_ARTICLES, 240, 24, 1200),
        })

        editorial.clusterCount = clusters.length

        const sanity = createSanityWriteClientFromEnv()
        const synced = await syncEditorialDrafts({
          client: sanity.client,
          schemaId: sanity.schemaId,
          clusters,
          transformEnabled: asBoolean(process.env.EDITORIAL_TRANSFORM_ENABLED, true),
          now: generatedAt,
          congestionRules: defaultCongestionRules,
        })

        editorial.newsItemCount = synced.newsItemCount
        editorial.digestCount = synced.digestCount
        editorial.transformAttemptedCount = synced.transformAttemptedCount
        editorial.transformSucceededCount = synced.transformSucceededCount
        editorial.transformFailedCount = synced.transformFailedCount

        await persistStoryClusters({
          supabase,
          runId,
          generatedAt,
          clusters,
          syncedClusters: synced.clusters,
        })

        await completeEditorialRun(supabase, runId, {
          status: 'succeeded',
          articleCount: editorial.articleCount,
          clusterCount: editorial.clusterCount,
          transformAttemptedCount: editorial.transformAttemptedCount,
          transformSuccessCount: editorial.transformSucceededCount,
          transformFailedCount: editorial.transformFailedCount,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown editorial pipeline failure.'
        editorial.error = message

        await completeEditorialRun(supabase, runId, {
          status: 'failed',
          articleCount: editorial.articleCount,
          clusterCount: editorial.clusterCount,
          transformAttemptedCount: editorial.transformAttemptedCount,
          transformSuccessCount: editorial.transformSucceededCount,
          transformFailedCount: editorial.transformFailedCount,
          errorMessage: message,
        })
      }
    }

    const semaphorSyncEnabled = asBoolean(process.env.EDITORIAL_SEMAPHOR_SYNC_ENABLED, true)
    const semaphorLimit = parsePositiveInt(process.env.EDITORIAL_SEMAPHOR_LIMIT, 200, 1, 200)
    const semaphorConcurrency = parsePositiveInt(process.env.EDITORIAL_SEMAPHOR_CONCURRENCY, 4, 1, 10)
    const semaphorTimeoutMs = parsePositiveInt(process.env.EDITORIAL_SEMAPHOR_TIMEOUT_MS, 20000, 5000, 30000)

    const semaphor: {
      enabled: boolean
      fetchedStories: number
      processed: number
      synced: number
      failed: number
      error: string | null
      errors: Array<{
        storyId: string
        articleUrl: string
        message: string
      }>
    } = {
      enabled: semaphorSyncEnabled,
      fetchedStories: 0,
      processed: 0,
      synced: 0,
      failed: 0,
      error: null,
      errors: [],
    }

    if (semaphorSyncEnabled) {
      try {
        const sanity = createSanityTokenWriteClientFromEnv()
        const semaphorSync = await syncSemaphorSecurityNewsItemsToSanity({
          client: sanity,
          limit: semaphorLimit,
          concurrency: semaphorConcurrency,
          timeoutMs: semaphorTimeoutMs,
        })

        semaphor.fetchedStories = semaphorSync.fetchedStories
        semaphor.processed = semaphorSync.processed
        semaphor.synced = semaphorSync.synced
        semaphor.failed = semaphorSync.failed
        semaphor.errors = semaphorSync.errors.slice(0, 30)
      } catch (error) {
        semaphor.error = error instanceof Error ? error.message : 'Unknown Semafor sync failure.'
      }
    }

    const body = {
      ok: true,
      fetchedAt: pullResult.fetchedAt,
      sourceCount: pullResult.sourceCount,
      articleCount: pullResult.articleCount,
      upsertedSourceCount: persisted.upsertedSourceCount,
      upsertedArticleCount: persisted.upsertedArticleCount,
      usedLegacySourceSchema: persisted.usedLegacySchema,
      enrichment: {
        contentProcessed: contentResult.processed,
        contentFetched: contentResult.fetched,
        contentFailed: contentResult.failed,
        topicProcessed: topicResult.processed,
        topicWithMatches: topicResult.withTopics,
      },
      editorial,
      semaphor,
      sourceErrors: pullResult.errors,
    }

    return NextResponse.json(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown cron ingestion failure.'
    return NextResponse.json({ok: false, error: message}, {status: 500})
  }
}

export async function GET(request: Request) {
  return runIngestion(request)
}

export async function POST(request: Request) {
  return runIngestion(request)
}
