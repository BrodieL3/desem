import {NextResponse} from 'next/server'

import {getCuratedStoryDetail} from '@/lib/editorial/ui-server'

type RouteContext = {
  params: Promise<{clusterKey: string}>
}

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

function parseBatchLimit(value: string | null) {
  return parseIntParam(value, 4, 1, 24)
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

export async function GET(request: Request, context: RouteContext) {
  const {clusterKey} = await context.params
  const url = new URL(request.url)

  const offset = parseIntParam(url.searchParams.get('offset'), 0, 0, 2000)
  const limit = parseBatchLimit(url.searchParams.get('limit'))
  const preview = resolvePreviewParam(url.searchParams.get('preview'))

  const data = await getCuratedStoryDetail(clusterKey, {
    offset,
    limit,
    preview,
  })

  if (!data) {
    return NextResponse.json({error: 'Story cluster not found.'}, {status: 404})
  }

  return NextResponse.json({
    data,
    meta: {
      offset: data.offset,
      limit: data.limit,
      totalFeedBlocks: data.totalFeedBlocks,
      totalEvidence: data.totalEvidence,
      hasMore: data.hasMore,
      preview,
      source: data.source,
    },
  })
}
