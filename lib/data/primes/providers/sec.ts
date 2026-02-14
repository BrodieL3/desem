import type {PrimeFilingCandidate, PrimeFilingType} from '../types'

type SecRecentFilings = {
  accessionNumber?: string[]
  form?: string[]
  filingDate?: string[]
  reportDate?: string[]
  primaryDocument?: string[]
}

type SecSubmissionsPayload = {
  filings?: {
    recent?: SecRecentFilings
  }
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function filingTypeOrNull(value: string | null | undefined): PrimeFilingType | null {
  const normalized = compact(value).toUpperCase()

  if (normalized === '10-Q' || normalized === '10-K' || normalized === '8-K') {
    return normalized
  }

  return null
}

export function normalizeSecCik(cik: string) {
  return cik.replace(/\D/g, '').padStart(10, '0')
}

function secUserAgent() {
  const explicitAgent = compact(process.env.SEC_USER_AGENT)

  if (explicitAgent) {
    return explicitAgent
  }

  return 'FieldBrief/1.0 (contact: support@fieldbrief.local)'
}

function buildFilingUrl(input: {cik: string; accessionNo: string; primaryDocument: string | null}) {
  const accessionDigits = input.accessionNo.replace(/-/g, '')

  if (!accessionDigits) {
    return null
  }

  if (input.primaryDocument) {
    return `https://www.sec.gov/Archives/edgar/data/${Number.parseInt(input.cik, 10)}/${accessionDigits}/${input.primaryDocument}`
  }

  return `https://www.sec.gov/Archives/edgar/data/${Number.parseInt(input.cik, 10)}/${accessionDigits}`
}

export async function fetchSecFilingCandidates(input: {
  cik: string
  forms?: PrimeFilingType[]
  limit?: number
}): Promise<PrimeFilingCandidate[]> {
  const cik = normalizeSecCik(input.cik)
  const requestedForms = new Set((input.forms ?? ['10-Q', '10-K', '8-K']).map((form) => form.toUpperCase()))
  const limit = Math.max(1, Math.min(input.limit ?? 20, 120))
  const response = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: {
      'User-Agent': secUserAgent(),
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`SEC submissions request failed (${response.status}).`)
  }

  const payload = (await response.json()) as SecSubmissionsPayload
  const recent = payload.filings?.recent

  if (!recent) {
    return []
  }

  const forms = recent.form ?? []
  const accessions = recent.accessionNumber ?? []
  const filingDates = recent.filingDate ?? []
  const reportDates = recent.reportDate ?? []
  const primaryDocuments = recent.primaryDocument ?? []

  const maxLength = Math.max(forms.length, accessions.length, filingDates.length, reportDates.length, primaryDocuments.length)
  const candidates: PrimeFilingCandidate[] = []

  for (let index = 0; index < maxLength; index += 1) {
    const form = forms[index] ?? ''

    if (!requestedForms.has(form.toUpperCase())) {
      continue
    }

    const accessionNo = compact(accessions[index])

    if (!accessionNo) {
      continue
    }

    const primaryDocument = compact(primaryDocuments[index]) || null

    candidates.push({
      accessionNo,
      filingType: filingTypeOrNull(form),
      filedAt: compact(filingDates[index]),
      reportDate: compact(reportDates[index]) || null,
      primaryDocument,
      filingUrl: buildFilingUrl({
        cik,
        accessionNo,
        primaryDocument,
      }),
    })

    if (candidates.length >= limit) {
      break
    }
  }

  return candidates
}
