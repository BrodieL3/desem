import {NextResponse} from 'next/server'

import {getArticleListForApi} from '@/lib/articles/server'
import {getAuthenticatedUser} from '@/lib/user/session'

function parseIntParam(value: string | null, fallback: number, min: number, max: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

export async function GET(request: Request) {
  const url = new URL(request.url)

  const q = url.searchParams.get('q') ?? undefined
  const topic = url.searchParams.get('topic') ?? undefined
  const limit = parseIntParam(url.searchParams.get('limit'), 30, 1, 100)
  const offset = parseIntParam(url.searchParams.get('offset'), 0, 0, 2000)

  const user = await getAuthenticatedUser()

  const articles = await getArticleListForApi({
    query: q,
    topicSlug: topic,
    limit,
    offset,
    userId: user?.id ?? null,
  })

  return NextResponse.json({
    data: articles,
    meta: {
      count: articles.length,
      limit,
      offset,
    },
  })
}
