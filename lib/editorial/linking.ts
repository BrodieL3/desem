const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function isSemaforUrl(value: string | null | undefined) {
  const url = compact(value)

  if (!url) {
    return false
  }

  try {
    const parsed = new URL(url)
    return parsed.hostname.toLowerCase().includes('semafor.com')
  } catch {
    return false
  }
}

export function isUuidLike(value: string | null | undefined) {
  return UUID_PATTERN.test(compact(value))
}

export function resolveInternalStoryHref(input: {
  articleId?: string | null
  clusterKey?: string | null
  sourceUrl?: string | null
}) {
  const articleId = compact(input.articleId)
  const clusterKey = compact(input.clusterKey)

  // Semafor stream IDs are not ingested article IDs; keep them on internal story routes.
  if (isSemaforUrl(input.sourceUrl)) {
    const semaforStoryKey = articleId || clusterKey

    if (semaforStoryKey) {
      return `/stories/${encodeURIComponent(semaforStoryKey)}`
    }
  }

  if (articleId && isUuidLike(articleId)) {
    return `/articles/${encodeURIComponent(articleId)}`
  }

  const fallbackKey = clusterKey || articleId

  if (fallbackKey) {
    return `/stories/${encodeURIComponent(fallbackKey)}`
  }

  return '/'
}
