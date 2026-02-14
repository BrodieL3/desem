import {NextResponse} from 'next/server'

import {getCuratedHomeData} from '@/lib/editorial/ui-server'
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

function parseBooleanParam(value: string | null, fallback: boolean) {
  if (!value) {
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

function resolvePreviewParam(value: string | null) {
  if (value !== null) {
    return parseBooleanParam(value, false)
  }

  return parseBooleanParam(process.env.EDITORIAL_SANITY_PREVIEW_DRAFTS ?? null, false)
}

export async function GET(request: Request) {
  const url = new URL(request.url)

  const limit = parseIntParam(url.searchParams.get('limit'), 72, 1, 120)
  const fallbackRaw = parseBooleanParam(url.searchParams.get('fallbackRaw'), true)
  const preview = resolvePreviewParam(url.searchParams.get('preview'))
  const user = await getAuthenticatedUser()

  const data = await getCuratedHomeData({
    limit,
    fallbackRaw,
    preview,
    userId: user?.id ?? null,
  })

  return NextResponse.json({
    data,
    meta: {
      stories: data.stories.length,
      forYouStories: data.forYou?.stories.length ?? 0,
      limit,
      fallbackRaw,
      preview,
      source: data.source,
    },
  })
}
