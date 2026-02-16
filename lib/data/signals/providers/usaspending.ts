import type {DefenseMoneyUsaspendingTransaction} from '../types'

type UsaspendingTransactionRow = {
  'Action Date'?: string
  'Award ID'?: string
  'Recipient Name'?: string
  'Awarding Agency'?: string
  'Transaction Amount'?: number | string
  'Transaction Description'?: string
  naics_code?: string
  product_or_service_code?: string
  generated_internal_id?: string
  internal_id?: number
}

type UsaspendingResponse = {
  results?: UsaspendingTransactionRow[]
  page_metadata?: {
    hasNext?: boolean
    next?: number | null
    page?: number
  }
  messages?: string[]
}

export type FetchUsaspendingTransactionsOptions = {
  apiBaseUrl?: string
  actionDate: string
  awardingAgencies: string[]
  minTransactionUsd: number
  maxPages: number
}

const DEFAULT_AWARD_TYPE_CODES = ['A', 'B', 'C', 'D']

function toNumber(value: number | string | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function sourceUrlForGeneratedId(value: string) {
  return `https://api.usaspending.gov/api/v2/awards/${encodeURIComponent(value)}/`
}

function normalizeRow(row: UsaspendingTransactionRow): DefenseMoneyUsaspendingTransaction | null {
  const generatedInternalId = compact(row.generated_internal_id)
  const actionDate = compact(row['Action Date'])
  const awardId = compact(row['Award ID'])
  const recipientName = compact(row['Recipient Name'])
  const awardingAgencyName = compact(row['Awarding Agency'])
  const transactionAmount = toNumber(row['Transaction Amount'])

  if (!generatedInternalId || !actionDate || !awardId || !recipientName || !awardingAgencyName || transactionAmount === null) {
    return null
  }

  return {
    generatedInternalId,
    actionDate,
    awardId,
    recipientName,
    awardingAgencyName,
    transactionAmount,
    transactionDescription: compact(row['Transaction Description']) || null,
    naicsCode: compact(row.naics_code) || null,
    pscCode: compact(row.product_or_service_code) || null,
    sourceUrl: sourceUrlForGeneratedId(generatedInternalId),
    rawPayload: row as unknown as Record<string, unknown>,
  }
}

export async function fetchUsaspendingTransactions(options: FetchUsaspendingTransactionsOptions) {
  const apiBaseUrl = options.apiBaseUrl ?? 'https://api.usaspending.gov'
  const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/v2/search/spending_by_transaction/`
  const warnings: string[] = []
  const transactions: DefenseMoneyUsaspendingTransaction[] = []

  for (let page = 1; page <= options.maxPages; page += 1) {
    const payload = {
      fields: [
        'Action Date',
        'Recipient Name',
        'Transaction Amount',
        'Award ID',
        'Awarding Agency',
        'Transaction Description',
        'naics_code',
        'product_or_service_code',
        'generated_internal_id',
      ],
      limit: 100,
      page,
      sort: 'Transaction Amount',
      order: 'desc',
      filters: {
        award_type_codes: DEFAULT_AWARD_TYPE_CODES,
        time_period: [
          {
            start_date: options.actionDate,
            end_date: options.actionDate,
            date_type: 'action_date',
          },
        ],
        agencies: options.awardingAgencies.map((name) => ({
          type: 'awarding',
          tier: 'toptier',
          name,
        })),
      },
    }

    let response: Response | null = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        if (response.ok || response.status < 500) {
          break
        }
      } catch {
        // transient network error — retry
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)))
        response = null
      }
    }

    if (!response || !response.ok) {
      throw new Error(`USAspending transaction request failed (${response?.status ?? 'network error'}).`)
    }

    const result = (await response.json()) as UsaspendingResponse

    for (const warning of result.messages ?? []) {
      warnings.push(warning)
    }

    const rows = result.results ?? []

    if (rows.length === 0) {
      break
    }

    for (const row of rows) {
      const normalized = normalizeRow(row)

      if (!normalized) {
        continue
      }

      if (normalized.transactionAmount < options.minTransactionUsd) {
        continue
      }

      transactions.push({
        ...normalized,
        rawPayload: row as unknown as Record<string, unknown>,
      })
    }

    const minAmountInPage = rows
      .map((row) => toNumber(row['Transaction Amount']))
      .filter((value): value is number => value !== null)
      .reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY)

    const hasBelowThreshold = Number.isFinite(minAmountInPage) && minAmountInPage < options.minTransactionUsd
    const hasNext = Boolean(result.page_metadata?.hasNext)

    if (!hasNext || hasBelowThreshold) {
      break
    }
  }

  const dedupedByGeneratedId = new Map<string, DefenseMoneyUsaspendingTransaction>()

  for (const transaction of transactions) {
    dedupedByGeneratedId.set(transaction.generatedInternalId, transaction)
  }

  const deduped = [...dedupedByGeneratedId.values()]

  return {
    transactions: deduped,
    warnings,
  }
}
