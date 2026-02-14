import {NextResponse} from 'next/server'

import {createOptionalSanityServerClient} from '@/lib/sanity/client'

function asBoolean(value: string | null) {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function parseLimit(value: string | null, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(1, Math.min(parsed, 100))
}

export async function GET(request: Request) {
  if ((process.env.EDITORIAL_SANITY_READS_ENABLED ?? 'true').toLowerCase() === 'false') {
    return NextResponse.json({error: 'Editorial Sanity feed is disabled.'}, {status: 503})
  }

  const sanity = createOptionalSanityServerClient()

  if (!sanity) {
    return NextResponse.json({error: 'Sanity environment is not configured.'}, {status: 500})
  }

  const url = new URL(request.url)
  const limit = parseLimit(url.searchParams.get('limit'), 24)
  const preview = asBoolean(url.searchParams.get('preview'))

  const query = preview
    ? `*[_type == "storyDigest" && _id in path("drafts.**")]
        | order(generatedAt desc)[0...$limit]{
          clusterKey,
          headline,
          dek,
          keyPoints,
          whyItMatters,
          riskLevel,
          generationMode,
          reviewStatus,
          isCongestedCluster,
          citationCount,
          hasOfficialSource,
          reportingCount,
          analysisCount,
          officialCount,
          opinionCount,
          pressReleaseDriven,
          opinionLimited,
          sourceDiversity,
          representativeArticleId,
          generatedAt,
        }`
    : `*[_type == "storyDigest" && !(_id in path("drafts.**"))]
        | order(generatedAt desc)[0...$limit]{
          clusterKey,
          headline,
          dek,
          keyPoints,
          whyItMatters,
          riskLevel,
          generationMode,
          reviewStatus,
          isCongestedCluster,
          citationCount,
          hasOfficialSource,
          reportingCount,
          analysisCount,
          officialCount,
          opinionCount,
          pressReleaseDriven,
          opinionLimited,
          sourceDiversity,
          representativeArticleId,
          generatedAt,
        }`

  const data = await sanity.fetch<Array<Record<string, unknown>>>(query, {limit})

  return NextResponse.json({
    data,
    meta: {
      count: data.length,
      limit,
      preview,
      source: 'sanity',
    },
  })
}
