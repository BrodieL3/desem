import {Readability} from '@mozilla/readability'
import {JSDOM} from 'jsdom'

type ExtractStatus = 'fetched' | 'failed'

export interface ExtractedArticleContent {
  fullText: string | null
  fullTextExcerpt: string | null
  leadImageUrl: string | null
  canonicalImageUrl: string | null
  wordCount: number
  readingMinutes: number
  contentFetchStatus: ExtractStatus
  contentFetchError: string | null
  contentFetchedAt: string
}

const contentFallbackSelectors = [
  'article',
  'main',
  '[role="main"]',
  '.article-body',
  '.post-content',
  '.entry-content',
  '.story-body',
  '.content-body',
]

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function safeUrl(rawValue: string | null | undefined, baseUrl: string) {
  if (!rawValue) {
    return null
  }

  const trimmed = rawValue.trim()

  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('javascript:')) {
    return null
  }

  try {
    return new URL(trimmed, baseUrl).toString()
  } catch {
    return null
  }
}

function getWordMetrics(fullText: string) {
  const words = fullText.split(/\s+/).filter(Boolean)
  const wordCount = words.length

  if (wordCount === 0) {
    return {
      wordCount: 0,
      readingMinutes: 0,
    }
  }

  return {
    wordCount,
    readingMinutes: Math.max(1, Math.ceil(wordCount / 220)),
  }
}

function buildExcerpt(fullText: string, maxLength = 460) {
  if (fullText.length <= maxLength) {
    return fullText
  }

  return `${fullText.slice(0, maxLength - 1).trimEnd()}…`
}

function extractLeadImage(document: Document, articleUrl: string) {
  const metaSelectors = [
    'meta[property="og:image"]',
    'meta[name="og:image"]',
    'meta[property="twitter:image"]',
    'meta[name="twitter:image"]',
  ]

  for (const selector of metaSelectors) {
    const node = document.querySelector(selector)

    if (!node) {
      continue
    }

    const content = node.getAttribute('content')
    const url = safeUrl(content, articleUrl)

    if (url) {
      return url
    }
  }

  const imageNodes = Array.from(document.querySelectorAll('article img, main img, img'))

  for (const node of imageNodes) {
    const src = node.getAttribute('src') || node.getAttribute('data-src') || node.getAttribute('data-original')
    const url = safeUrl(src, articleUrl)

    if (!url) {
      continue
    }

    const lowered = url.toLowerCase()
    if (lowered.endsWith('.svg') || lowered.includes('logo')) {
      continue
    }

    return url
  }

  return null
}

function extractTextFallback(document: Document) {
  for (const selector of contentFallbackSelectors) {
    const node = document.querySelector(selector)

    if (!node) {
      continue
    }

    const text = collapseWhitespace(node.textContent ?? '')

    if (text.split(/\s+/).length >= 80) {
      return text
    }
  }

  return collapseWhitespace(document.body?.textContent ?? '')
}

function failWith(message: string): ExtractedArticleContent {
  return {
    fullText: null,
    fullTextExcerpt: null,
    leadImageUrl: null,
    canonicalImageUrl: null,
    wordCount: 0,
    readingMinutes: 0,
    contentFetchStatus: 'failed',
    contentFetchError: message,
    contentFetchedAt: new Date().toISOString(),
  }
}

export function extractArticleContentFromHtml(articleUrl: string, html: string): ExtractedArticleContent {
  let dom: JSDOM

  try {
    dom = new JSDOM(html, {url: articleUrl})
  } catch {
    return failWith('Unable to parse article HTML.')
  }

  const document = dom.window.document
  const leadImage = extractLeadImage(document, articleUrl)

  let extractedText = ''

  try {
    const readability = new Readability(document)
    const parsed = readability.parse()

    extractedText = collapseWhitespace(parsed?.textContent ?? '')
  } catch {
    extractedText = ''
  }

  if (!extractedText || extractedText.split(/\s+/).length < 80) {
    extractedText = extractTextFallback(document)
  }

  if (!extractedText || extractedText.split(/\s+/).length < 40) {
    return failWith('No usable article body found.')
  }

  const {wordCount, readingMinutes} = getWordMetrics(extractedText)

  return {
    fullText: extractedText,
    fullTextExcerpt: buildExcerpt(extractedText),
    leadImageUrl: leadImage,
    canonicalImageUrl: leadImage,
    wordCount,
    readingMinutes,
    contentFetchStatus: 'fetched',
    contentFetchError: null,
    contentFetchedAt: new Date().toISOString(),
  }
}

export async function extractArticleContentFromUrl(
  articleUrl: string,
  options?: {
    timeoutMs?: number
    userAgent?: string
  }
): Promise<ExtractedArticleContent> {
  const timeoutMs = Math.max(1000, Math.min(options?.timeoutMs ?? 15000, 30000))

  try {
    const response = await fetch(articleUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': options?.userAgent ?? 'FieldBriefAggregatorBot/2.0 (+https://localhost)',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      return failWith(`Article request failed with status ${response.status}.`)
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

    if (contentType && !contentType.includes('text/html') && !contentType.includes('xml')) {
      return failWith(`Unsupported content type: ${contentType}`)
    }

    const html = await response.text()

    if (!html.trim()) {
      return failWith('Article response body was empty.')
    }

    return extractArticleContentFromHtml(articleUrl, html)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown extraction failure.'
    return failWith(message)
  }
}
