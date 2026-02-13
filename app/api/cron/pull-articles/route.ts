import {NextResponse} from 'next/server'

import {
  enrichArticleContentBatch,
  enrichArticleTopicsBatch,
  getArticlesByFetchedAt,
} from '@/lib/ingest/enrich-articles'
import {pullDefenseArticles} from '@/lib/ingest/pull-defense-articles'
import {createSupabaseAdminClientFromEnv, upsertPullResultToSupabase} from '@/lib/ingest/persist'

export const dynamic = 'force-dynamic'

function authorizeCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return true
  }

  return request.headers.get('authorization') === `Bearer ${cronSecret}`
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
