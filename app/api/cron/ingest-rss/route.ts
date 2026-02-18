import {NextResponse} from 'next/server'

import {pullDefenseArticles} from '@/lib/ingest/pull-defense-articles'
import {createSupabaseAdminClientFromEnv, upsertPullResultToSupabase} from '@/lib/ingest/persist'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

  try {
    const pullResult = await pullDefenseArticles({
      sinceHours: 72,
      maxPerSource: 80,
      limit: 1600,
      timeoutMs: 20000,
    })

    const supabase = createSupabaseAdminClientFromEnv()
    const persisted = await upsertPullResultToSupabase(supabase, pullResult)

    return NextResponse.json({
      ok: true,
      fetchedAt: pullResult.fetchedAt,
      sourceCount: pullResult.sourceCount,
      articleCount: pullResult.articleCount,
      upsertedSourceCount: persisted.upsertedSourceCount,
      upsertedArticleCount: persisted.upsertedArticleCount,
      sourceErrors: pullResult.errors,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ingest-rss failure.'
    console.error('[ingest-rss]', message)
    return NextResponse.json({ok: false, error: message}, {status: 500})
  }
}

export async function GET(request: Request) {
  return run(request)
}

export async function POST(request: Request) {
  return run(request)
}
