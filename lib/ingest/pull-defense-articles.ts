import {XMLParser} from 'fast-xml-parser'

import {defenseFeedSources, type DefenseFeedSource} from './sources'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  cdataPropName: '__cdata',
})

const trackingParams = new Set([
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'mkt_tok',
  'igshid',
  'cmpid',
  'ocid',
  'ref',
  'spm',
])

const namedHtmlEntities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

const sourceWeightLookup = new Map(defenseFeedSources.map((source) => [source.id, source.weight]))

export interface PulledArticle {
  sourceId: string
  sourceName: string
  sourceCategory: DefenseFeedSource['category']
  sourceBadge: string
  sourceFeedUrl: string
  sourceHomepageUrl: string
  sourceWeight: number
  title: string
  url: string
  summary: string
  publishedAt?: string
  author?: string
  guid?: string
}

export interface PullDefenseArticlesOptions {
  sourceIds?: string[]
  maxPerSource?: number
  limit?: number
  sinceHours?: number
  timeoutMs?: number
}

export interface PullDefenseArticlesError {
  sourceId: string
  sourceName: string
  message: string
}

export interface PullDefenseArticlesResult {
  fetchedAt: string
  sourceCount: number
  articleCount: number
  articles: PulledArticle[]
  errors: PullDefenseArticlesError[]
}

type RecordValue = Record<string, unknown>

type ParsedFeed = {
  source: DefenseFeedSource
  articles: PulledArticle[]
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

function asRecord(value: unknown): RecordValue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as RecordValue
}

function readText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = readText(entry)
      if (text) {
        return text
      }
    }

    return ''
  }

  const record = asRecord(value)
  if (!record) {
    return ''
  }

  const candidateKeys = ['#text', '__cdata', '_', 'text', 'value']
  for (const key of candidateKeys) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return ''
}

function stripHtml(input: string): string {
  const decoded = input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity: string, token: string) => {
    const normalized = token.toLowerCase()

    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16)
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint)
    }

    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10)
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint)
    }

    return namedHtmlEntities[normalized] ?? entity
  })

  return decoded
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateSummary(text: string, maxLength = 420): string {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

function normalizeTimestamp(value: unknown): string | undefined {
  const text = readText(value)
  if (!text) {
    return undefined
  }

  const epoch = Date.parse(text)
  if (Number.isNaN(epoch)) {
    return undefined
  }

  return new Date(epoch).toISOString()
}

function canonicalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  try {
    const parsed = new URL(trimmed)
    parsed.hash = ''

    const keys = [...parsed.searchParams.keys()]
    for (const key of keys) {
      const lowered = key.toLowerCase()
      if (lowered.startsWith('utm_') || trackingParams.has(lowered)) {
        parsed.searchParams.delete(key)
      }
    }

    return parsed.toString()
  } catch {
    return trimmed
  }
}

function extractRssLink(item: RecordValue): string {
  const directLink = canonicalizeUrl(readText(item.link))
  if (directLink) {
    return directLink
  }

  const atomLinks = asArray(item['atom:link'])
  for (const rawLink of atomLinks) {
    const linkRecord = asRecord(rawLink)
    if (!linkRecord) {
      continue
    }

    const href = canonicalizeUrl(readText(linkRecord.href))
    if (href) {
      return href
    }
  }

  return canonicalizeUrl(readText(item.guid))
}

function extractAtomLink(entry: RecordValue): string {
  const links = asArray(entry.link)
  let fallback = ''

  for (const rawLink of links) {
    if (typeof rawLink === 'string') {
      const candidate = canonicalizeUrl(rawLink)
      if (candidate && !fallback) {
        fallback = candidate
      }
      continue
    }

    const linkRecord = asRecord(rawLink)
    if (!linkRecord) {
      continue
    }

    const href = canonicalizeUrl(readText(linkRecord.href))
    if (!href) {
      continue
    }

    const rel = readText(linkRecord.rel).toLowerCase()
    if (!rel || rel === 'alternate') {
      return href
    }

    if (!fallback) {
      fallback = href
    }
  }

  return fallback
}

function normalizeRssItem(source: DefenseFeedSource, rawItem: unknown): PulledArticle | null {
  const item = asRecord(rawItem)
  if (!item) {
    return null
  }

  const title = stripHtml(readText(item.title))
  const url = extractRssLink(item)

  if (!title || !url) {
    return null
  }

  const summary =
    stripHtml(readText(item.description)) || stripHtml(readText(item['content:encoded'])) || stripHtml(readText(item.content))

  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceCategory: source.category,
    sourceBadge: source.sourceBadge,
    sourceFeedUrl: source.feedUrl,
    sourceHomepageUrl: source.homepageUrl,
    sourceWeight: source.weight,
    title,
    url,
    summary: truncateSummary(summary),
    publishedAt:
      normalizeTimestamp(item.pubDate) ||
      normalizeTimestamp(item['dc:date']) ||
      normalizeTimestamp(item.published) ||
      normalizeTimestamp(item.updated),
    author: stripHtml(readText(item.author) || readText(item['dc:creator'])) || undefined,
    guid: readText(item.guid) || undefined,
  }
}

function extractAtomAuthor(entry: RecordValue): string | undefined {
  const authorRecord = asRecord(entry.author)
  const value = stripHtml(readText(authorRecord?.name || entry.author))
  return value || undefined
}

function normalizeAtomEntry(source: DefenseFeedSource, rawEntry: unknown): PulledArticle | null {
  const entry = asRecord(rawEntry)
  if (!entry) {
    return null
  }

  const title = stripHtml(readText(entry.title))
  const url = extractAtomLink(entry)

  if (!title || !url) {
    return null
  }

  const summary = stripHtml(readText(entry.summary) || readText(entry.content))

  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceCategory: source.category,
    sourceBadge: source.sourceBadge,
    sourceFeedUrl: source.feedUrl,
    sourceHomepageUrl: source.homepageUrl,
    sourceWeight: source.weight,
    title,
    url,
    summary: truncateSummary(summary),
    publishedAt: normalizeTimestamp(entry.published) || normalizeTimestamp(entry.updated),
    author: extractAtomAuthor(entry),
    guid: readText(entry.id) || undefined,
  }
}

function parseArticlesForSource(source: DefenseFeedSource, xml: string): PulledArticle[] {
  let parsedXml: unknown

  try {
    parsedXml = parser.parse(xml)
  } catch {
    return []
  }

  const root = asRecord(parsedXml)
  if (!root) {
    return []
  }

  const rss = asRecord(root.rss)
  if (rss) {
    const channel = asRecord(asArray(rss.channel)[0])
    if (!channel) {
      return []
    }

    return asArray(channel.item)
      .map((item) => normalizeRssItem(source, item))
      .filter((item): item is PulledArticle => item !== null)
  }

  const atomFeed = asRecord(root.feed)
  if (atomFeed) {
    return asArray(atomFeed.entry)
      .map((entry) => normalizeAtomEntry(source, entry))
      .filter((entry): entry is PulledArticle => entry !== null)
  }

  return []
}

function publishedEpoch(article: PulledArticle): number {
  if (!article.publishedAt) {
    return 0
  }

  const epoch = Date.parse(article.publishedAt)
  return Number.isNaN(epoch) ? 0 : epoch
}

function articleDedupKey(article: PulledArticle): string {
  if (article.url) {
    return `url:${article.url.toLowerCase()}`
  }

  const normalizedTitle = article.title.toLowerCase().replace(/\s+/g, ' ').trim()
  const day = article.publishedAt?.slice(0, 10) || 'unknown-day'

  return `title:${normalizedTitle}:${day}`
}

function articleRank(article: PulledArticle): number {
  const sourceWeight = sourceWeightLookup.get(article.sourceId) ?? article.sourceWeight
  const published = publishedEpoch(article)
  const summaryScore = Math.min(article.summary.length, 320)
  return sourceWeight * 1000 + published + summaryScore
}

function dedupeArticles(articles: PulledArticle[]): PulledArticle[] {
  const deduped = new Map<string, PulledArticle>()

  for (const article of articles) {
    const key = articleDedupKey(article)
    const existing = deduped.get(key)

    if (!existing || articleRank(article) > articleRank(existing)) {
      deduped.set(key, article)
    }
  }

  return [...deduped.values()]
}

async function pullSource(source: DefenseFeedSource, timeoutMs: number, maxPerSource: number): Promise<ParsedFeed> {
  const response = await fetch(source.feedUrl, {
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
      'User-Agent': 'FieldBriefIngestBot/0.1 (+https://localhost)',
    },
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`Feed request failed with status ${response.status}`)
  }

  const body = await response.text()
  const articles = parseArticlesForSource(source, body)
    .sort((a, b) => publishedEpoch(b) - publishedEpoch(a))
    .slice(0, maxPerSource)

  return {
    source,
    articles,
  }
}

export function resolveDefenseSources(sourceIds?: string[]): DefenseFeedSource[] {
  if (!sourceIds || sourceIds.length === 0) {
    return defenseFeedSources
  }

  const lookup = new Set(sourceIds.map((sourceId) => sourceId.trim().toLowerCase()).filter(Boolean))

  return defenseFeedSources.filter((source) => lookup.has(source.id.toLowerCase()))
}

export async function pullDefenseArticles(options: PullDefenseArticlesOptions = {}): Promise<PullDefenseArticlesResult> {
  const maxPerSource = Math.max(1, Math.min(options.maxPerSource ?? 30, 100))
  const limit = Math.max(1, Math.min(options.limit ?? 200, 1000))
  const timeoutMs = Math.max(1500, Math.min(options.timeoutMs ?? 15000, 90000))
  const sinceHours = Math.max(1, Math.min(options.sinceHours ?? 168, 24 * 90))

  const sources = resolveDefenseSources(options.sourceIds)
  const errors: PullDefenseArticlesError[] = []

  const results = await Promise.allSettled(sources.map((source) => pullSource(source, timeoutMs, maxPerSource)))

  const articles: PulledArticle[] = []

  for (let index = 0; index < results.length; index += 1) {
    const source = sources[index]
    const result = results[index]

    if (result.status === 'fulfilled') {
      articles.push(...result.value.articles)
      continue
    }

    errors.push({
      sourceId: source.id,
      sourceName: source.name,
      message: result.reason instanceof Error ? result.reason.message : 'Unknown ingestion error',
    })
  }

  const sinceCutoffEpoch = Date.now() - sinceHours * 60 * 60 * 1000
  const filtered = articles.filter((article) => {
    if (!article.publishedAt) {
      return true
    }

    return publishedEpoch(article) >= sinceCutoffEpoch
  })

  const deduped = dedupeArticles(filtered).sort((a, b) => publishedEpoch(b) - publishedEpoch(a)).slice(0, limit)

  return {
    fetchedAt: new Date().toISOString(),
    sourceCount: sources.length,
    articleCount: deduped.length,
    articles: deduped,
    errors,
  }
}
