import {NextResponse} from 'next/server'

import {pullDefenseArticles} from '@/lib/ingest/pull-defense-articles'
import {createSupabaseAdminClientFromEnv, upsertPullResultToSupabase} from '@/lib/ingest/persist'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorizeCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return true
  }

  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

async function run(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const result = {
    ok: true,
    rss: {
      status: 'succeeded' as 'succeeded' | 'failed',
      fetchedAt: null as string | null,
      sourceCount: 0,
      articleCount: 0,
      upsertedSourceCount: 0,
      upsertedArticleCount: 0,
      error: null as string | null,
    },
    content: {
      status: 'succeeded' as 'succeeded' | 'failed',
      processed: 0,
      fetched: 0,
      failed: 0,
      error: null as string | null,
    },
    topics: {
      status: 'succeeded' as 'succeeded' | 'failed',
      processed: 0,
      withTopics: 0,
      failed: 0,
      error: null as string | null,
    },
  }

  const supabase = createSupabaseAdminClientFromEnv()

  // Step 1: Pull RSS feeds and upsert to DB
  try {
    const pullResult = await pullDefenseArticles({
      sinceHours: 72,
      maxPerSource: 80,
      limit: 1600,
      timeoutMs: 20000,
    })

    const persisted = await upsertPullResultToSupabase(supabase, pullResult)

    result.rss.fetchedAt = pullResult.fetchedAt
    result.rss.sourceCount = pullResult.sourceCount
    result.rss.articleCount = pullResult.articleCount
    result.rss.upsertedSourceCount = persisted.upsertedSourceCount
    result.rss.upsertedArticleCount = persisted.upsertedArticleCount
  } catch (error) {
    result.rss.status = 'failed'
    result.rss.error = error instanceof Error ? error.message : 'Unknown RSS ingest failure.'
    console.error('[ingest:rss]', result.rss.error)
  }

  // Dynamic import to avoid jsdom ESM crash at module load time
  const {
    enrichArticleContentBatch,
    enrichArticleTopicsBatch,
    getArticlesNeedingContent,
    getArticlesMissingTopics,
  } = await import('@/lib/ingest/enrich-articles')

  // Step 2: Enrich content for pending articles
  try {
    const pending = await getArticlesNeedingContent(supabase, 15)

    if (pending.length > 0) {
      const contentResult = await enrichArticleContentBatch(supabase, pending, {
        concurrency: 5,
        timeoutMs: 15000,
      })

      result.content.processed = contentResult.processed
      result.content.fetched = contentResult.fetched
      result.content.failed = contentResult.failed
    }
  } catch (error) {
    result.content.status = 'failed'
    result.content.error = error instanceof Error ? error.message : 'Unknown content enrichment failure.'
    console.error('[ingest:content]', result.content.error)
  }

  // Step 3: Extract topics for articles missing them
  try {
    const missing = await getArticlesMissingTopics(supabase, 10)

    if (missing.length > 0) {
      const topicResult = await enrichArticleTopicsBatch(supabase, missing, {
        concurrency: 2,
      })

      result.topics.processed = topicResult.processed
      result.topics.withTopics = topicResult.withTopics
      result.topics.failed = topicResult.failed
    }
  } catch (error) {
    result.topics.status = 'failed'
    result.topics.error = error instanceof Error ? error.message : 'Unknown topic enrichment failure.'
    console.error('[ingest:topics]', result.topics.error)
  }

  const hasFailed = result.rss.status === 'failed' || result.content.status === 'failed' || result.topics.status === 'failed'
  result.ok = !hasFailed

  const statusCode = hasFailed ? 207 : 200
  return NextResponse.json(result, {status: statusCode})
}

export async function GET(request: Request) {
  return run(request)
}

export async function POST(request: Request) {
  return run(request)
}
