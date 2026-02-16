import {sanitizePlainText} from '@/lib/utils'

const SEMAPHOR_SECURITY_URL = 'https://www.semafor.com/vertical/security'
const SEMAPHOR_CONTENT_API_URL = 'https://api.semafor.com/content'
const ARTICLE_PATH_PATTERN = /^\/article\/\d{2}\/\d{2}\/\d{4}\//
const MAX_SECURITY_STORIES = 200

export type SemaphorSecurityStory = {
  id: string
  articleUrl: string
  headline: string
  subtitle: string
  imageUrl: string | null
  publishedAt: string
}

type SemaphorSecurityStreamDocument = {
  id: string | null
  slug: string | null
  headline: string | null
  subtitle: string | null
  publishedAt: string | null
  imageUrl: string | null
}

type SemaphorContentApiPayload = {
  result?: {
    documents?: SemaphorSecurityStreamDocument[]
  } | null
}

function compact(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  return sanitizePlainText(value).replace(/\s+/g, ' ').trim()
}

function extractPublishedAt(articlePath: string, fallback = new Date().toISOString()) {
  const match = articlePath.match(/^\/article\/(\d{2})\/(\d{2})\/(\d{4})\//)

  if (!match) {
    return fallback
  }

  const [, month, day, year] = match
  const iso = `${year}-${month}-${day}T12:00:00.000Z`
  const parsed = new Date(iso)

  if (Number.isNaN(parsed.getTime())) {
    return fallback
  }

  return parsed.toISOString()
}

function toStoryId(articlePath: string) {
  return `semafor-security-${articlePath.replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase()}`
}

function toAbsoluteUrl(value: string | null | undefined, base = SEMAPHOR_SECURITY_URL) {
  const clean = value?.trim()

  if (!clean) {
    return null
  }

  try {
    return new URL(clean, base).toString()
  } catch {
    return null
  }
}

function normalizePublishedAt(value: string | null | undefined, articlePath: string) {
  const parsed = value ? new Date(value) : null

  if (parsed && !Number.isNaN(parsed.getTime())) {
    return parsed.toISOString()
  }

  return extractPublishedAt(articlePath)
}

function normalizeSemaphorStory(input: {
  id: string | null | undefined
  slug: string | null | undefined
  headline: string | null | undefined
  subtitle: string | null | undefined
  imageUrl: string | null | undefined
  publishedAt: string | null | undefined
}) {
  const articleUrl = toAbsoluteUrl(input.slug)

  if (!articleUrl) {
    return null
  }

  const articlePath = new URL(articleUrl).pathname

  if (!ARTICLE_PATH_PATTERN.test(articlePath)) {
    return null
  }

  const headline = compact(input.headline)

  if (!headline) {
    return null
  }

  return {
    id: compact(input.id) || toStoryId(articlePath),
    articleUrl,
    headline,
    subtitle: compact(input.subtitle),
    imageUrl: toAbsoluteUrl(input.imageUrl),
    publishedAt: normalizePublishedAt(input.publishedAt, articlePath),
  } satisfies SemaphorSecurityStory
}

function buildSemaphorSecurityQuery(limit: number) {
  const upperBound = Math.max(60, Math.min(limit * 3, 300))

  return `*[_type == "stream" && stream == "verticalSecurity"][0]{
    "documents": (
      (streamDocuments)[
        article != null
        && (expires == false || dateTime(expiresAt) > dateTime(now()))
        && article->_type in ["article", "newsletter", "hub", "liveEvent"]
        && article->publishedTimestamp != null
        && !(article->_id in path('drafts.**'))
      ] +
      (streamDocuments)[
        article != null
        && (expires == true && dateTime(expiresAt) < dateTime(now()))
        && article->_type in ["article", "newsletter", "hub", "liveEvent"]
        && article->publishedTimestamp != null
        && !(article->_id in path('drafts.**'))
      ]
    )[0..${upperBound}]{
      "id": coalesce(article->_id, _key),
      "slug": article->slug.current,
      "headline": select(headlineOverride != "" => headlineOverride, article->headline.headline),
      "subtitle": coalesce(pt::text(descriptionOverride), pt::text(article->description), pt::text(article->intro), ""),
      "publishedAt": article->publishedTimestamp,
      "imageUrl": coalesce(
        article->ledePhoto.ledephoto.imageEmbed.asset->url,
        article->meta.opengraph.image.asset->url,
        article->socialImage.asset->url
      )
    }
  }`
}

async function fetchStoriesFromSemaphorContentApi(limit: number) {
  const url = new URL(SEMAPHOR_CONTENT_API_URL)
  url.searchParams.set('query', buildSemaphorSecurityQuery(limit))

  const apiResponse = await fetch(url, {
    headers: {
      accept: 'application/json',
      origin: 'https://www.semafor.com',
      referer: SEMAPHOR_SECURITY_URL,
      'user-agent': 'Mozilla/5.0 (Field Brief crawler)',
    },
    next: {revalidate: 1800},
  })

  if (!apiResponse.ok) {
    return [] as SemaphorSecurityStory[]
  }

  const payload = (await apiResponse.json()) as SemaphorContentApiPayload
  const documents = payload.result?.documents ?? []
  const storiesByUrl = new Map<string, SemaphorSecurityStory>()

  for (const document of documents) {
    const story = normalizeSemaphorStory(document)

    if (!story || storiesByUrl.has(story.articleUrl)) {
      continue
    }

    storiesByUrl.set(story.articleUrl, story)
  }

  return [...storiesByUrl.values()]
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, limit)
}

function toHeadlineFromArticlePath(articlePath: string) {
  const slug = articlePath.split('/').filter(Boolean).at(-1) ?? ''

  if (!slug) {
    return 'Security update'
  }

  return slug
    .split('-')
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function extractArticlePathsFromHtml(html: string) {
  const articlePaths = new Set<string>()
  const hrefPattern = /href=['"]([^'"]+)['"]/gi

  for (const match of html.matchAll(hrefPattern)) {
    const href = match[1]?.trim()

    if (!href) {
      continue
    }

    const absolute = toAbsoluteUrl(href)

    if (!absolute) {
      continue
    }

    const path = new URL(absolute).pathname

    if (ARTICLE_PATH_PATTERN.test(path)) {
      articlePaths.add(path)
    }
  }

  return [...articlePaths]
}

async function fetchStoriesFromSemaphorSecurityPage(limit: number) {
  const response = await fetch(SEMAPHOR_SECURITY_URL, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 (Field Brief crawler)',
    },
    next: {revalidate: 1800},
  })

  if (!response.ok) {
    return [] as SemaphorSecurityStory[]
  }

  const html = await response.text()
  const storiesByUrl = new Map<string, SemaphorSecurityStory>()

  for (const articlePath of extractArticlePathsFromHtml(html)) {
    const story = normalizeSemaphorStory({
      id: toStoryId(articlePath),
      slug: articlePath,
      headline: toHeadlineFromArticlePath(articlePath),
      subtitle: null,
      imageUrl: null,
      publishedAt: null,
    })

    if (!story || storiesByUrl.has(story.articleUrl)) {
      continue
    }

    storiesByUrl.set(story.articleUrl, story)
  }

  return [...storiesByUrl.values()]
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, limit)
}

export async function fetchSemaphorSecurityStories(limit = 24): Promise<SemaphorSecurityStory[]> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), MAX_SECURITY_STORIES))
  const fromApi = await fetchStoriesFromSemaphorContentApi(safeLimit)

  if (fromApi.length > 0) {
    return fromApi
  }

  return fetchStoriesFromSemaphorSecurityPage(safeLimit)
}
