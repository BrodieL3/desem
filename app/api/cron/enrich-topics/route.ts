import {NextResponse} from 'next/server'

import {enrichArticleTopicsBatch, getArticlesMissingTopics} from '@/lib/ingest/enrich-articles'
import {createSupabaseAdminClientFromEnv} from '@/lib/ingest/persist'

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

  try {
    const supabase = createSupabaseAdminClientFromEnv()
    const articles = await getArticlesMissingTopics(supabase, 15)

    if (articles.length === 0) {
      return NextResponse.json({ok: true, processed: 0, withTopics: 0, failed: 0, message: 'No articles pending topic extraction.'})
    }

    const result = await enrichArticleTopicsBatch(supabase, articles, {
      concurrency: 2,
    })

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      withTopics: result.withTopics,
      failed: result.failed,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown enrich-topics failure.'
    console.error('[enrich-topics]', message)
    return NextResponse.json({ok: false, error: message}, {status: 500})
  }
}

export async function GET(request: Request) {
  return run(request)
}

export async function POST(request: Request) {
  return run(request)
}
