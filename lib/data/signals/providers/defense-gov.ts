import {classifyDefenseMoneyBucket} from '../taxonomy'
import type {DefenseMoneyBucket} from '../types'

export type DefenseGovContract = {
  announcementDate: string
  contractNumber: string
  contractorName: string
  awardingAgency: string
  awardAmount: number
  location: string | null
  description: string
  bucketPrimary: DefenseMoneyBucket
  bucketTags: DefenseMoneyBucket[]
  sourceUrl: string
  rawHtml: string
}

type RssItem = {
  title: string
  link: string
  pubDate: string
  description: string
}

function compact(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function extractTextBetween(html: string, startTag: string, endTag: string): string {
  const startIdx = html.indexOf(startTag)

  if (startIdx === -1) {
    return ''
  }

  const contentStart = startIdx + startTag.length
  const endIdx = html.indexOf(endTag, contentStart)

  if (endIdx === -1) {
    return html.slice(contentStart)
  }

  return html.slice(contentStart, endIdx)
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  let cursor = 0

  while (true) {
    const itemStart = xml.indexOf('<item>', cursor)

    if (itemStart === -1) {
      break
    }

    const itemEnd = xml.indexOf('</item>', itemStart)

    if (itemEnd === -1) {
      break
    }

    const itemXml = xml.slice(itemStart, itemEnd + 7)

    const title = stripHtml(extractTextBetween(itemXml, '<title>', '</title>'))
    const link = compact(extractTextBetween(itemXml, '<link>', '</link>'))
    const pubDate = compact(extractTextBetween(itemXml, '<pubDate>', '</pubDate>'))

    let description = ''
    const cdataStart = itemXml.indexOf('<description><![CDATA[')

    if (cdataStart !== -1) {
      const cdataContentStart = cdataStart + '<description><![CDATA['.length
      const cdataEnd = itemXml.indexOf(']]></description>', cdataContentStart)
      description = cdataEnd !== -1 ? itemXml.slice(cdataContentStart, cdataEnd) : ''
    } else {
      description = extractTextBetween(itemXml, '<description>', '</description>')
    }

    items.push({title, link, pubDate, description})
    cursor = itemEnd + 7
  }

  return items
}

function parsePubDateToIso(pubDate: string): string | null {
  const parsed = new Date(pubDate)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

function parseAmount(text: string): number {
  // Match patterns like "$1,234,567,890" or "$1.2 billion" or "$450 million"
  const billionMatch = text.match(/\$\s*([\d,.]+)\s*billion/i)

  if (billionMatch) {
    return Number.parseFloat(billionMatch[1]!.replace(/,/g, '')) * 1_000_000_000
  }

  const millionMatch = text.match(/\$\s*([\d,.]+)\s*million/i)

  if (millionMatch) {
    return Number.parseFloat(millionMatch[1]!.replace(/,/g, '')) * 1_000_000
  }

  const rawMatch = text.match(/\$\s*([\d,]+(?:\.\d+)?)/)

  if (rawMatch) {
    return Number.parseFloat(rawMatch[1]!.replace(/,/g, ''))
  }

  return 0
}

function parseContractsFromDescription(
  html: string,
  announcementDate: string,
  sourceUrl: string,
): DefenseGovContract[] {
  const contracts: DefenseGovContract[] = []
  const text = stripHtml(html)

  // Defense.gov format: paragraphs starting with company name, then agency, amount, description
  // Split on double newlines or paragraph patterns
  const paragraphs = text
    .split(/\n{2,}|(?=\b[A-Z][A-Z\s&.,]+(?:Inc\.|Corp\.|LLC|Co\.|Ltd\.)?)/)
    .map((p) => p.trim())
    .filter((p) => p.length > 50 && /\$/.test(p))

  for (const paragraph of paragraphs) {
    const amount = parseAmount(paragraph)

    if (amount < 1_000_000) {
      continue
    }

    // Extract contractor name — usually the first sentence or clause
    const contractorMatch = paragraph.match(
      /^([A-Z][A-Za-z\s&.,'-]+(?:Inc\.|Corp\.|LLC|Co\.|Ltd\.|Company|Corporation|Group|Systems|Technologies|Defense|Sciences|Dynamics))/,
    )

    const contractorName = compact(contractorMatch?.[1]?.replace(/,\s*$/, '')) || 'Unknown Contractor'

    // Extract awarding agency — look for Army, Navy, Air Force, etc.
    const agencyMatch = paragraph.match(
      /(Army|Navy|Air Force|Marine Corps|Space Force|Defense Logistics Agency|Missile Defense Agency|Defense Advanced Research Projects Agency|DARPA|Defense Information Systems Agency|DISA|Defense Health Agency|Special Operations Command)/i,
    )

    const awardingAgency = compact(agencyMatch?.[1]) || 'Department of Defense'

    // Extract contract number — patterns like FA8726-25-C-0001
    const contractNumberMatch = paragraph.match(
      /([A-Z]{1,3}\d{4,}-\d{2}-[A-Z]-\d{4}|[A-Z]\d{5,}|W\d{3,}[A-Z\d-]+|N\d{5}-\d{2}-[A-Z]-\d{4}|HQ\d+-\d{2}-[A-Z]-\d{4})/,
    )

    const contractNumber = compact(contractNumberMatch?.[1]) || `DGOV-${announcementDate}-${contracts.length}`

    // Extract location
    const locationMatch = paragraph.match(
      /(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/,
    )

    const location = compact(locationMatch?.[1]) || null

    const classification = classifyDefenseMoneyBucket({
      pscCode: null,
      naicsCode: null,
      transactionDescription: paragraph,
    })

    contracts.push({
      announcementDate,
      contractNumber,
      contractorName,
      awardingAgency,
      awardAmount: amount,
      location,
      description: paragraph.slice(0, 2000),
      bucketPrimary: classification.primary,
      bucketTags: classification.tags,
      sourceUrl,
      rawHtml: html.slice(0, 5000),
    })
  }

  return contracts
}

export type FetchDefenseGovContractsOptions = {
  rssUrl?: string
  lookbackDays?: number
}

export async function fetchDefenseGovDailyContracts(
  options: FetchDefenseGovContractsOptions = {},
): Promise<{contracts: DefenseGovContract[]; warnings: string[]}> {
  const rssUrl =
    options.rssUrl ||
    'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=9&Site=945'
  const lookbackDays = options.lookbackDays ?? 7
  const warnings: string[] = []

  let response: Response | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'FieldBrief/1.0 (defense-tech-briefing)',
        },
      })

      if (response.ok || response.status < 500) {
        break
      }
    } catch {
      // transient
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)))
      response = null
    }
  }

  if (!response || !response.ok) {
    const status = response?.status ?? 'network error'
    warnings.push(`Defense.gov RSS fetch failed (${status}).`)
    return {contracts: [], warnings}
  }

  const xml = await response.text()
  const items = parseRssItems(xml)

  if (items.length === 0) {
    warnings.push('Defense.gov RSS returned no items.')
    return {contracts: [], warnings}
  }

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)
  const cutoffIso = cutoffDate.toISOString().slice(0, 10)

  const contracts: DefenseGovContract[] = []

  for (const item of items) {
    const announcementDate = parsePubDateToIso(item.pubDate)

    if (!announcementDate) {
      continue
    }

    if (announcementDate < cutoffIso) {
      continue
    }

    const parsed = parseContractsFromDescription(item.description, announcementDate, item.link)
    contracts.push(...parsed)
  }

  return {contracts, warnings}
}
