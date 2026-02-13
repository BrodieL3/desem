import {NextResponse} from 'next/server'

import {buildStoryClusters} from '@/lib/editorial/clustering'
import {defaultCongestionRules} from '@/lib/editorial/congestion'
import type {EditorialArticle, EditorialTopic, StoryCluster} from '@/lib/editorial/types'
import {
  enrichArticleContentBatch,
  enrichArticleTopicsBatch,
  getArticlesByFetchedAt,
} from '@/lib/ingest/enrich-articles'
import {pullDefenseArticles} from '@/lib/ingest/pull-defense-articles'
import {createSupabaseAdminClientFromEnv, upsertPullResultToSupabase} from '@/lib/ingest/persist'
import {createSanityWriteClientFromEnv} from '@/lib/sanity/client'
import {syncEditorialDrafts} from '@/lib/sanity/sync'

export const dynamic = 'force-dynamic'

type EditorialArticleRow = {
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
  word_count: number | null
  reading_minutes: number | null
  content_fetch_status: string | null
}

type EditorialTopicRow = {
  article_id: string
  is_primary: boolean | null
  topics:
    | {
        id: string
        slug: string
        label: string
      }
    | Array<{
        id: string
        slug: string
        label: string
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

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function resolveTopic(value: EditorialTopicRow['topics']) {
  if (!value) {
    return null
  }

  return Array.isArray(value) ? value[0] ?? null : value
}

async function fetchRecentEditorialArticles(
  supabase: ReturnType<typeof createSupabaseAdminClientFromEnv>,
  options?: {
    windowHours?: number
    limit?: number
  }
): Promise<EditorialArticle[]> {
  const windowHours = options?.windowHours ?? 48
  const limit = options?.limit ?? 1200
  const minFetchedAt = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

  const {data: rows, error: rowError} = await supabase
    .from('ingested_articles')
    .select(
      'id, title, summary, full_text_excerpt, article_url, source_id, source_name, source_badge, published_at, fetched_at, word_count, reading_minutes, content_fetch_status'
    )
    .neq('source_badge', 'Policy doc')
    .neq('source_badge', 'DoD release')
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
    .select('article_id, is_primary, topics(id, slug, label)')
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
      isPrimary: Boolean(topicRow.is_primary),
    })

    topicsByArticleId.set(topicRow.article_id, topics)
  }

  return safeRows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    fullTextExcerpt: row.full_text_excerpt,
    articleUrl: row.article_url,
    sourceId: row.source_id,
    sourceName: row.source_name,
    sourceBadge: row.source_badge,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    wordCount: Math.max(0, Number(row.word_count ?? 0)),
    readingMinutes: Math.max(0, Number(row.reading_minutes ?? 0)),
    contentFetchStatus: row.content_fetch_status,
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
  const syncedByKey = new Map(input.syncedClusters.map((cluster) => [cluster.clusterKey, cluster]))

  const rows = input.clusters.map((cluster) => {
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

  for (const cluster of input.clusters) {
    const clusterId = clusterIdByKey.get(cluster.clusterKey)

    if (!clusterId) {
      continue
    }

    for (const member of cluster.members) {
      memberRows.push({
        cluster_id: clusterId,
        article_id: member.article.id,
        similarity: Number(member.similarity.toFixed(3)),
        is_representative: member.isRepresentative,
      })
    }
  }

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
    const pullResult = await pullDefenseArticles({
      sinceHours: 30,
      maxPerSource: 40,
      limit: 800,
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
      concurrency: 5,
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
      error: null,
    }

    if (editorialEnabled) {
      const generatedAt = new Date()
      const runId = await beginEditorialRun(supabase, pullResult.fetchedAt)
      editorial.runId = runId

      try {
        const editorialArticles = await fetchRecentEditorialArticles(supabase, {
          windowHours: 48,
          limit: 1200,
        })

        editorial.articleCount = editorialArticles.length

        const clusters = await buildStoryClusters(editorialArticles, {
          threshold: Number(process.env.EDITORIAL_CLUSTER_THRESHOLD ?? '0.72'),
          windowHours: 48,
          openAIApiKey: asBoolean(process.env.EDITORIAL_EMBEDDINGS_ENABLED, true)
            ? process.env.OPENAI_API_KEY
            : undefined,
          embeddingModel: process.env.EDITORIAL_EMBEDDING_MODEL ?? 'text-embedding-3-small',
          maxEmbeddingArticles: Number(process.env.EDITORIAL_MAX_EMBEDDING_ARTICLES ?? '120'),
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

    const body = {
      ok: true,
      fetchedAt: pullResult.fetchedAt,
      sourceCount: pullResult.sourceCount,
      articleCount: pullResult.articleCount,
      upsertedSourceCount: persisted.upsertedSourceCount,
      upsertedArticleCount: persisted.upsertedArticleCount,
      enrichment: {
        contentProcessed: contentResult.processed,
        contentFetched: contentResult.fetched,
        contentFailed: contentResult.failed,
        topicProcessed: topicResult.processed,
        topicWithMatches: topicResult.withTopics,
      },
      editorial,
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
