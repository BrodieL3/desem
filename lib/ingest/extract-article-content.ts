import {Readability} from '@mozilla/readability'

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

const semaforArticlePathPattern = /^\/article\/\d{2}\/\d{2}\/\d{4}\//
const nextFlightChunkLiteralPattern = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g

type SemaforArticlePayload = {
  headline?: string | null
  description?: unknown
  intro?: unknown
  semaforms?: unknown
  sematexts?: unknown
  signal?: unknown
  tragedy?: unknown
}

type PlainRecord = Record<string, unknown>

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function countWords(value: string) {
  return value.split(/\s+/).filter(Boolean).length
}

function asRecord(value: unknown): PlainRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as PlainRecord
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

function isSemaforArticleUrl(articleUrl: string) {
  try {
    const parsed = new URL(articleUrl)
    return parsed.hostname.endsWith('semafor.com') && semaforArticlePathPattern.test(parsed.pathname)
  } catch {
    return false
  }
}

function extractPortableTextBlock(block: unknown) {
  const record = asRecord(block)

  if (!record) {
    return ''
  }

  if (record._type === 'block' && Array.isArray(record.children)) {
    const text = record.children
      .map((child) => {
        const childRecord = asRecord(child)
        return typeof childRecord?.text === 'string' ? childRecord.text : ''
      })
      .join('')

    return collapseWhitespace(text)
  }

  if (typeof record.text === 'string') {
    return collapseWhitespace(record.text)
  }

  const imageEmbed = asRecord(record.imageEmbed)
  if (typeof imageEmbed?.caption === 'string') {
    return collapseWhitespace(imageEmbed.caption)
  }

  if (typeof record.caption === 'string') {
    return collapseWhitespace(record.caption)
  }

  return ''
}

function extractPortableText(value: unknown) {
  if (typeof value === 'string') {
    return collapseWhitespace(value)
  }

  if (!Array.isArray(value)) {
    return ''
  }

  return value
    .map((entry) => extractPortableTextBlock(entry))
    .filter(Boolean)
    .join('\n\n')
}

function pushUnique(segments: string[], value: string) {
  const text = value.trim()

  if (!text) {
    return
  }

  const normalized = collapseWhitespace(text).toLowerCase()

  if (segments.some((entry) => collapseWhitespace(entry).toLowerCase() === normalized)) {
    return
  }

  segments.push(text)
}

function extractSemaforPayloadFromScript(script: string): SemaforArticlePayload | null {
  if (!script.includes('__next_f.push') || !script.includes('\\\"article\\\"')) {
    return null
  }

  const chunkPattern = new RegExp(nextFlightChunkLiteralPattern.source, 'g')

  for (const match of script.matchAll(chunkPattern)) {
    const literal = match[1]

    if (!literal) {
      continue
    }

    let chunk = ''

    try {
      chunk = JSON.parse(literal) as string
    } catch {
      continue
    }

    if (!chunk.includes('"article"')) {
      continue
    }

    const separatorIndex = chunk.indexOf(':')
    if (separatorIndex < 0) {
      continue
    }

    const serializedPayload = chunk.slice(separatorIndex + 1).trim()
    let parsedPayload: unknown

    try {
      parsedPayload = JSON.parse(serializedPayload)
    } catch {
      continue
    }

    if (!Array.isArray(parsedPayload)) {
      continue
    }

    const payload = asRecord(parsedPayload[3])
    const article = asRecord(payload?.article)

    if (article) {
      return article as SemaforArticlePayload
    }
  }

  return null
}

function extractSemaforSectionText(section: PlainRecord) {
  const segments: string[] = []
  const title = typeof section.title === 'string' ? collapseWhitespace(section.title) : ''

  if (title) {
    segments.push(title)
  }

  for (const [key, value] of Object.entries(section)) {
    if (key.startsWith('_') || key === 'title' || key === 'schemaVersion') {
      continue
    }

    const text = extractPortableText(value)
    if (text) {
      segments.push(text)
    }
  }

  return segments.join('\n\n')
}

function extractSemaforArticleText(document: Document, articleUrl: string) {
  if (!isSemaforArticleUrl(articleUrl)) {
    return ''
  }

  const scripts = Array.from(document.querySelectorAll('script'))
  let payload: SemaforArticlePayload | null = null

  for (const script of scripts) {
    const content = script.textContent ?? ''
    payload = extractSemaforPayloadFromScript(content)

    if (payload) {
      break
    }
  }

  if (!payload) {
    return ''
  }

  const leadSegments: string[] = []
  pushUnique(leadSegments, extractPortableText(payload.intro))

  const bodySegments: string[] = []

  if (Array.isArray(payload.semaforms)) {
    for (const section of payload.semaforms) {
      const sectionRecord = asRecord(section)

      if (!sectionRecord) {
        continue
      }

      pushUnique(bodySegments, extractSemaforSectionText(sectionRecord))
    }
  }

  pushUnique(bodySegments, extractPortableText(payload.sematexts))
  pushUnique(bodySegments, extractPortableText(payload.signal))
  pushUnique(bodySegments, extractPortableText(payload.tragedy))

  if (bodySegments.length === 0) {
    pushUnique(leadSegments, extractPortableText(payload.description))
  }

  const combined = bodySegments.length > 0 ? [...leadSegments, ...bodySegments] : leadSegments

  return combined.join('\n\n').trim()
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

export async function extractArticleContentFromHtml(articleUrl: string, html: string): Promise<ExtractedArticleContent> {
  const {JSDOM, VirtualConsole} = await import('jsdom')
  let dom: InstanceType<typeof JSDOM>

  try {
    const virtualConsole = new VirtualConsole()

    // Ignore noisy stylesheet parse warnings from malformed publisher CSS.
    virtualConsole.on('jsdomError', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)

      if (message.includes('Could not parse CSS stylesheet')) {
        return
      }

      console.warn('[content-extract]', message)
    })

    dom = new JSDOM(html, {
      url: articleUrl,
      virtualConsole,
    })
  } catch {
    return failWith('Unable to parse article HTML.')
  }

  const document = dom.window.document
  const leadImage = extractLeadImage(document, articleUrl)
  const isSemaforArticle = isSemaforArticleUrl(articleUrl)
  const bodyReadFloor = isSemaforArticle ? 40 : 80

  let extractedText = extractSemaforArticleText(document, articleUrl)

  if (!extractedText || countWords(extractedText) < bodyReadFloor) {
    try {
      const readability = new Readability(document)
      const parsed = readability.parse()

      extractedText = collapseWhitespace(parsed?.textContent ?? '')
    } catch {
      extractedText = ''
    }
  }

  if (!extractedText || countWords(extractedText) < bodyReadFloor) {
    extractedText = extractTextFallback(document)
  }

  if (!extractedText || countWords(extractedText) < 40) {
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
