import {classifyDefenseMoneyBucket} from '../taxonomy'
import type {DefenseMoneyBucket} from '../types'

export type SamGovOpportunity = {
  opportunityId: string
  noticeType: 'presolicitation' | 'solicitation' | 'award' | 'special_notice'
  title: string
  solicitationNumber: string | null
  department: string | null
  subTier: string | null
  office: string | null
  postedDate: string
  responseDeadline: string | null
  archiveDate: string | null
  naicsCode: string | null
  classificationCode: string | null
  setAside: string | null
  description: string | null
  estimatedValueLow: number | null
  estimatedValueHigh: number | null
  bucketPrimary: DefenseMoneyBucket | null
  bucketTags: DefenseMoneyBucket[]
  sourceUrl: string
  rawPayload: Record<string, unknown>
}

type SamGovApiResponse = {
  totalRecords?: number
  opportunitiesData?: SamGovApiOpportunity[]
  error?: string
}

type SamGovApiOpportunity = {
  noticeId?: string
  type?: string
  title?: string
  solicitationNumber?: string
  department?: string
  subtierAgency?: string
  office?: string
  fullParentPathName?: string
  postedDate?: string
  responseDeadLine?: string
  archiveDate?: string
  naicsCode?: string
  classificationCode?: string
  typeOfSetAside?: string
  description?: string
  additionalInfoLink?: string
  uiLink?: string
  award?: {
    amount?: number | string
    awardee?: {
      name?: string
    }
  }
  pointOfContact?: Array<{
    fullName?: string
    email?: string
  }>
}

const NOTICE_TYPE_MAP: Record<string, SamGovOpportunity['noticeType']> = {
  // Single-letter codes (ptype parameter format)
  p: 'presolicitation',
  o: 'solicitation',
  k: 'award',
  r: 'special_notice',
  s: 'special_notice',
  i: 'special_notice',
  // Full string values from API response type field
  presolicitation: 'presolicitation',
  solicitation: 'solicitation',
  'combined synopsis/solicitation': 'solicitation',
  award: 'award',
  'special notice': 'special_notice',
  'sources sought': 'presolicitation',
  'intent to bundle requirements (dod-funded)': 'special_notice',
  'justification and approval (j&a)': 'award',
  'fair opportunity / limited sources justification': 'award',
  'sale of surplus property': 'special_notice',
}

function compact(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeNoticeType(value: string | undefined): SamGovOpportunity['noticeType'] | null {
  if (!value) {
    return null
  }

  const lower = value.trim().toLowerCase()
  return NOTICE_TYPE_MAP[lower] ?? null
}

function toIsoDate(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  // SAM.gov dates can be in various formats
  const trimmed = value.trim()

  // ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }

  // MM/DD/YYYY format
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)

  if (mdyMatch) {
    const month = mdyMatch[1]!.padStart(2, '0')
    const day = mdyMatch[2]!.padStart(2, '0')
    return `${mdyMatch[3]}-${month}-${day}`
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

function normalizeOpportunity(raw: SamGovApiOpportunity): SamGovOpportunity | null {
  const opportunityId = compact(raw.noticeId)
  const noticeType = normalizeNoticeType(raw.type)
  const title = compact(raw.title)
  const postedDate = toIsoDate(raw.postedDate)

  if (!opportunityId || !noticeType || !title || !postedDate) {
    return null
  }

  const description = compact(raw.description)
  const naicsCode = compact(raw.naicsCode) || null
  const classificationCode = compact(raw.classificationCode) || null

  const classification = classifyDefenseMoneyBucket({
    pscCode: classificationCode,
    naicsCode,
    transactionDescription: `${title} ${description}`,
  })

  const hasMatch = classification.tags.length > 0 && classification.scores.some((s) => s.score > 0)

  // Extract department and subtier from fullParentPathName (e.g. "DEPT OF DEFENSE.DEPT OF THE ARMY.AMC...")
  const parentParts = (raw.fullParentPathName ?? '').split('.')
  const department = compact(raw.department) || compact(parentParts[0]) || null
  const subTier = compact(raw.subtierAgency) || compact(parentParts[1]) || null

  return {
    opportunityId,
    noticeType,
    title,
    solicitationNumber: compact(raw.solicitationNumber) || null,
    department,
    subTier,
    office: compact(raw.office) || null,
    postedDate,
    responseDeadline: toIsoDate(raw.responseDeadLine),
    archiveDate: toIsoDate(raw.archiveDate),
    naicsCode,
    classificationCode,
    setAside: compact(raw.typeOfSetAside) || null,
    description: description || null,
    estimatedValueLow: null,
    estimatedValueHigh: toNumber(raw.award?.amount),
    bucketPrimary: hasMatch ? classification.primary : null,
    bucketTags: classification.tags,
    sourceUrl:
      compact(raw.uiLink) ||
      `https://sam.gov/opp/${encodeURIComponent(opportunityId)}/view`,
    rawPayload: raw as unknown as Record<string, unknown>,
  }
}

export type FetchSamGovOpportunitiesOptions = {
  apiKey: string
  postedFrom: string
  postedTo: string
  departments?: string[]
  noticeTypes?: string[]
  limit?: number
  offset?: number
}

export async function fetchSamGovOpportunities(
  options: FetchSamGovOpportunitiesOptions,
): Promise<{opportunities: SamGovOpportunity[]; totalRecords: number; warnings: string[]}> {
  const warnings: string[] = []

  if (!options.apiKey) {
    return {opportunities: [], totalRecords: 0, warnings: ['SAM_GOV_API_KEY is missing; opportunities skipped.']}
  }

  const params = new URLSearchParams({
    api_key: options.apiKey,
    postedFrom: options.postedFrom,
    postedTo: options.postedTo,
    limit: String(options.limit ?? 100),
    offset: String(options.offset ?? 0),
  })

  if (options.departments && options.departments.length > 0) {
    // organizationName replaces deprecated deptname
    params.set('organizationName', options.departments.join(','))
  }

  if (options.noticeTypes && options.noticeTypes.length > 0) {
    params.set('ptype', options.noticeTypes.join(','))
  }

  const url = `https://api.sam.gov/opportunities/v2/search?${params.toString()}`

  let response: Response | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(url)

      if (response.ok || response.status < 500) {
        break
      }
    } catch {
      // transient
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)))
      response = null
    }
  }

  if (!response || !response.ok) {
    const status = response?.status ?? 'network error'
    warnings.push(`SAM.gov API request failed (${status}).`)
    return {opportunities: [], totalRecords: 0, warnings}
  }

  const rawText = await response.text()
  let result: SamGovApiResponse

  try {
    result = JSON.parse(rawText) as SamGovApiResponse
  } catch {
    warnings.push(`SAM.gov API returned non-JSON response (first 200 chars): ${rawText.slice(0, 200)}`)
    return {opportunities: [], totalRecords: 0, warnings}
  }

  if (result.error) {
    warnings.push(`SAM.gov API error: ${result.error}`)
    return {opportunities: [], totalRecords: 0, warnings}
  }

  const rawOpps = result.opportunitiesData ?? []
  const totalRecords = result.totalRecords ?? rawOpps.length

  if (rawOpps.length === 0 && totalRecords === 0) {
    const keys = Object.keys(result)
    if (keys.length > 0 && !keys.includes('opportunitiesData')) {
      warnings.push(`SAM.gov unexpected response shape: keys=[${keys.join(', ')}]`)
    }
  }

  const opportunities = rawOpps
    .map(normalizeOpportunity)
    .filter((opp): opp is SamGovOpportunity => opp !== null)

  return {opportunities, totalRecords, warnings}
}

export async function fetchAllSamGovOpportunities(
  options: Omit<FetchSamGovOpportunitiesOptions, 'offset' | 'limit'> & {maxPages?: number},
): Promise<{opportunities: SamGovOpportunity[]; warnings: string[]}> {
  const maxPages = options.maxPages ?? 10
  const limit = 100
  const allOpps: SamGovOpportunity[] = []
  const allWarnings: string[] = []

  for (let page = 0; page < maxPages; page += 1) {
    const {opportunities, totalRecords, warnings} = await fetchSamGovOpportunities({
      ...options,
      limit,
      offset: page * limit,
    })

    allWarnings.push(...warnings)
    allOpps.push(...opportunities)

    if (allOpps.length >= totalRecords || opportunities.length < limit) {
      break
    }

    // Rate limit courtesy
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  // Dedupe by opportunity ID
  const seen = new Set<string>()
  const deduped = allOpps.filter((opp) => {
    if (seen.has(opp.opportunityId)) {
      return false
    }

    seen.add(opp.opportunityId)
    return true
  })

  return {opportunities: deduped, warnings: allWarnings}
}
