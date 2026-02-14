import {createOptionalSupabaseServerClient} from '@/lib/supabase/server'

import {buildPrimeAlerts} from './alerts'
import {toPeriodLabel} from './parsers/normalize'
import type {
  PrimeCompanyDescriptor,
  PrimeCompanyRow,
  PrimeDashboardData,
  PrimeDashboardOptions,
  PrimeDisclosureStatus,
  PrimeMetricKey,
  PrimeMetricPointRow,
  PrimeReportingPeriodRow,
  PrimeSourceCitation,
  PrimeTableRow,
  PrimeTicker,
} from './types'
import {primeMetricKeyValues, primeTickerValues} from './types'

type PrimeRegistryEntry = PrimeCompanyDescriptor & {
  cik: string
  displayOrder: number
}

type ResolvedPeriodMetric = {
  value: number | null
  disclosureStatus: PrimeDisclosureStatus
  sourceUrl: string | null
  sourceNote: string | null
}

type ResolvedPeriodRecord = {
  periodId: string
  companyId: string
  ticker: PrimeTicker
  companyName: string
  periodEnd: string
  periodLabel: string
  filingType: string
  filingDate: string
  sourceUrl: string
  updatedAt: string | null
  metrics: Record<PrimeMetricKey, ResolvedPeriodMetric>
}

const DEFAULT_WINDOW_QUARTERS = 20
const MAX_WINDOW_QUARTERS = 24
const STALE_AFTER_DAYS = 140

const primeRegistry: PrimeRegistryEntry[] = [
  {
    ticker: 'LMT',
    name: 'Lockheed Martin',
    cik: '0000936468',
    colorToken: 'chart-1',
    displayOrder: 1,
  },
  {
    ticker: 'RTX',
    name: 'RTX',
    cik: '0000101829',
    colorToken: 'chart-2',
    displayOrder: 2,
  },
  {
    ticker: 'BA',
    name: 'Boeing',
    cik: '0000012927',
    colorToken: 'chart-3',
    displayOrder: 3,
  },
  {
    ticker: 'GD',
    name: 'General Dynamics',
    cik: '0000040533',
    colorToken: 'chart-4',
    displayOrder: 4,
  },
  {
    ticker: 'NOC',
    name: 'Northrop Grumman',
    cik: '0001133421',
    colorToken: 'chart-5',
    displayOrder: 5,
  },
]

function asBoolean(value: string | undefined, fallback = false) {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

function isPrimeTicker(value: string): value is PrimeTicker {
  return primeTickerValues.includes(value as PrimeTicker)
}

function asDisclosureStatus(value: string | null | undefined): PrimeDisclosureStatus {
  if (value === 'disclosed' || value === 'not_disclosed') {
    return value
  }

  return 'not_disclosed'
}

function normalizeWindow(windowQuarters: number | undefined) {
  if (typeof windowQuarters !== 'number' || !Number.isFinite(windowQuarters)) {
    return DEFAULT_WINDOW_QUARTERS
  }

  return Math.max(4, Math.min(MAX_WINDOW_QUARTERS, Math.trunc(windowQuarters)))
}

function emptyMetric(): ResolvedPeriodMetric {
  return {
    value: null,
    disclosureStatus: 'not_disclosed',
    sourceUrl: null,
    sourceNote: null,
  }
}

function metricMap(): Record<PrimeMetricKey, ResolvedPeriodMetric> {
  return {
    backlog_total_b: emptyMetric(),
    book_to_bill: emptyMetric(),
    revenue_b: emptyMetric(),
    orders_b: emptyMetric(),
  }
}

function defaultCompanies(): PrimeCompanyDescriptor[] {
  return primeRegistry.map(({ticker, name, colorToken}) => ({
    ticker,
    name,
    colorToken,
  }))
}

function resolveCompanies(companyRows: PrimeCompanyRow[]) {
  const registryByTicker = new Map(primeRegistry.map((entry) => [entry.ticker, entry]))

  const resolved = companyRows
    .filter((row) => row.is_active)
    .map((row) => {
      const ticker = row.ticker.toUpperCase()

      if (!isPrimeTicker(ticker)) {
        return null
      }

      const registry = registryByTicker.get(ticker)

      return {
        id: row.id,
        ticker,
        name: row.name,
        colorToken: registry?.colorToken ?? 'chart-1',
        displayOrder: row.display_order,
      }
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)

  return resolved.sort((left, right) => left.displayOrder - right.displayOrder)
}

function buildPeriodsForWindow(periodRows: PrimeReportingPeriodRow[], windowQuarters: number) {
  const grouped = new Map<string, PrimeReportingPeriodRow[]>()

  for (const row of periodRows) {
    const rows = grouped.get(row.company_id) ?? []
    rows.push(row)
    grouped.set(row.company_id, rows)
  }

  const selected: PrimeReportingPeriodRow[] = []

  for (const rows of grouped.values()) {
    const sorted = [...rows].sort((left, right) => Date.parse(right.period_end) - Date.parse(left.period_end))
    selected.push(...sorted.slice(0, windowQuarters))
  }

  return selected.sort((left, right) => Date.parse(right.period_end) - Date.parse(left.period_end))
}

function buildTableRows(periods: ResolvedPeriodRecord[]): PrimeTableRow[] {
  return periods.map((period) => {
    const notes = primeMetricKeyValues
      .map((metricKey) => {
        const metric = period.metrics[metricKey]

        if (metric.disclosureStatus === 'not_disclosed') {
          return `${metricKey.replaceAll('_', ' ')} not disclosed.`
        }

        if (!metric.sourceNote) {
          return null
        }

        return metric.sourceNote
      })
      .filter((note): note is string => Boolean(note))

    const sourceLinks = new Set<string>()
    sourceLinks.add(period.sourceUrl)

    for (const metricKey of primeMetricKeyValues) {
      const sourceUrl = period.metrics[metricKey].sourceUrl

      if (sourceUrl) {
        sourceLinks.add(sourceUrl)
      }
    }

    return {
      ticker: period.ticker,
      companyName: period.companyName,
      periodEnd: period.periodEnd,
      periodLabel: period.periodLabel,
      backlogTotalB: period.metrics.backlog_total_b.value,
      bookToBill: period.metrics.book_to_bill.value,
      revenueB: period.metrics.revenue_b.value,
      ordersB: period.metrics.orders_b.value,
      disclosureNotes: notes,
      sourceLinks: [...sourceLinks],
    }
  })
}

function buildSeries(periods: ResolvedPeriodRecord[]) {
  return primeMetricKeyValues.map((metricKey) => ({
    metricKey,
    points: periods.map((period) => {
      const metric = period.metrics[metricKey]

      return {
        ticker: period.ticker,
        periodEnd: period.periodEnd,
        periodLabel: period.periodLabel,
        value: metric.value,
        disclosureStatus: metric.disclosureStatus,
        sourceUrl: metric.sourceUrl,
      }
    }),
  }))
}

function buildSources(periods: ResolvedPeriodRecord[]) {
  const sourceMap = new Map<string, PrimeSourceCitation>()

  for (const period of periods) {
    const key = `${period.filingType}-${period.filingDate}-${period.sourceUrl}`

    if (sourceMap.has(key)) {
      continue
    }

    sourceMap.set(key, {
      id: period.periodId,
      filingType: period.filingType as PrimeSourceCitation['filingType'],
      filingDate: period.filingDate,
      sourceUrl: period.sourceUrl,
    })
  }

  return [...sourceMap.values()].sort((left, right) => Date.parse(right.filingDate) - Date.parse(left.filingDate))
}

function staleDataForPeriods(periods: ResolvedPeriodRecord[]) {
  const latest = periods[0]

  if (!latest) {
    return true
  }

  const latestTimestamp = Date.parse(latest.periodEnd)

  if (!Number.isFinite(latestTimestamp)) {
    return true
  }

  const ageDays = (Date.now() - latestTimestamp) / (1000 * 60 * 60 * 24)
  return ageDays > STALE_AFTER_DAYS
}

export function isPrimeDataEnabled() {
  return asBoolean(process.env.DATA_PRIMES_ENABLED, false)
}

export function getPrimeRegistry() {
  return primeRegistry.map(({ticker, name, cik, colorToken, displayOrder}) => ({
    ticker,
    name,
    cik,
    colorToken,
    displayOrder,
  }))
}

export function buildPrimeDashboardDataFromRows(input: {
  windowQuarters: number
  companyRows: PrimeCompanyRow[]
  periodRows: PrimeReportingPeriodRow[]
  metricRows: PrimeMetricPointRow[]
  generatedAt?: string
}): PrimeDashboardData {
  const companies = resolveCompanies(input.companyRows)
  const generatedAt = input.generatedAt ?? new Date().toISOString()

  if (companies.length === 0) {
    return {
      generatedAt,
      windowQuarters: input.windowQuarters,
      companies: defaultCompanies(),
      alerts: [],
      series: primeMetricKeyValues.map((metricKey) => ({metricKey, points: []})),
      tableRows: [],
      sources: [],
      staleData: true,
    }
  }

  const companyIds = companies.map((company) => company.id)
  const periodsInWindow = buildPeriodsForWindow(input.periodRows.filter((period) => companyIds.includes(period.company_id)), input.windowQuarters)

  if (periodsInWindow.length === 0) {
    return {
      generatedAt,
      windowQuarters: input.windowQuarters,
      companies: companies.map((company) => ({
        ticker: company.ticker,
        name: company.name,
        colorToken: company.colorToken,
      })),
      alerts: [],
      series: primeMetricKeyValues.map((metricKey) => ({metricKey, points: []})),
      tableRows: [],
      sources: [],
      staleData: true,
    }
  }

  const periodIds = new Set(periodsInWindow.map((period) => period.id))
  const metricRows = input.metricRows.filter((row) => periodIds.has(row.period_id))

  const companyById = new Map(
    companies.map((company) => [
      company.id,
      {
        ticker: company.ticker,
        name: company.name,
      },
    ])
  )

  const periodRecords = new Map<string, ResolvedPeriodRecord>()

  for (const period of periodsInWindow) {
    const company = companyById.get(period.company_id)

    if (!company) {
      continue
    }

    periodRecords.set(period.id, {
      periodId: period.id,
      companyId: period.company_id,
      ticker: company.ticker,
      companyName: company.name,
      periodEnd: period.period_end,
      periodLabel: toPeriodLabel({
        fiscalYear: period.fiscal_year,
        fiscalQuarter: period.fiscal_quarter,
      }),
      filingType: period.filing_type,
      filingDate: period.filing_date,
      sourceUrl: period.source_url,
      updatedAt: period.updated_at ?? null,
      metrics: metricMap(),
    })
  }

  for (const row of metricRows) {
    const period = periodRecords.get(row.period_id)

    if (!period) {
      continue
    }

    if (!primeMetricKeyValues.includes(row.metric_key as PrimeMetricKey)) {
      continue
    }

    const metricKey = row.metric_key as PrimeMetricKey

    period.metrics[metricKey] = {
      value: row.value_num,
      disclosureStatus: asDisclosureStatus(row.disclosure_status),
      sourceUrl: row.source_url,
      sourceNote: row.source_note,
    }
  }

  const sortedPeriods = [...periodRecords.values()].sort((left, right) => {
    const dateDiff = Date.parse(right.periodEnd) - Date.parse(left.periodEnd)

    if (dateDiff !== 0) {
      return dateDiff
    }

    const leftCompany = companies.find((company) => company.id === left.companyId)
    const rightCompany = companies.find((company) => company.id === right.companyId)

    return (leftCompany?.displayOrder ?? 999) - (rightCompany?.displayOrder ?? 999)
  })

  const tableRows = buildTableRows(sortedPeriods)
  const alerts = buildPrimeAlerts(tableRows)
  const series = buildSeries(sortedPeriods)
  const sources = buildSources(sortedPeriods)

  return {
    generatedAt,
    windowQuarters: input.windowQuarters,
    companies: companies.map((company) => ({
      ticker: company.ticker,
      name: company.name,
      colorToken: company.colorToken,
    })),
    alerts,
    series,
    tableRows,
    sources,
    staleData: staleDataForPeriods(sortedPeriods),
  }
}

export async function getPrimeDashboardData(options: PrimeDashboardOptions = {}): Promise<PrimeDashboardData> {
  const windowQuarters = normalizeWindow(options.windowQuarters)

  if (!isPrimeDataEnabled()) {
    return {
      generatedAt: new Date().toISOString(),
      windowQuarters,
      companies: defaultCompanies(),
      alerts: [],
      series: primeMetricKeyValues.map((metricKey) => ({metricKey, points: []})),
      tableRows: [],
      sources: [],
      staleData: true,
    }
  }

  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return {
      generatedAt: new Date().toISOString(),
      windowQuarters,
      companies: defaultCompanies(),
      alerts: [],
      series: primeMetricKeyValues.map((metricKey) => ({metricKey, points: []})),
      tableRows: [],
      sources: [],
      staleData: true,
    }
  }

  const {data: companyRows} = await supabase
    .from('prime_companies')
    .select('id, ticker, name, display_order, is_active')
    .eq('is_active', true)
    .order('display_order', {ascending: true})
    .returns<PrimeCompanyRow[]>()

  const companies = resolveCompanies(companyRows ?? [])
  const companyIds = companies.map((company) => company.id)

  if (companyIds.length === 0) {
    return buildPrimeDashboardDataFromRows({
      windowQuarters,
      companyRows: companyRows ?? [],
      periodRows: [],
      metricRows: [],
    })
  }

  const {data: periodRows} = await supabase
    .from('prime_reporting_periods')
    .select('id, company_id, fiscal_year, fiscal_quarter, period_end, filing_type, filing_date, source_url, updated_at')
    .in('company_id', companyIds)
    .order('period_end', {ascending: false})
    .limit(companyIds.length * MAX_WINDOW_QUARTERS * 2)
    .returns<PrimeReportingPeriodRow[]>()

  const periodIds = (periodRows ?? []).map((period) => period.id)
  const {data: metricRows} = await supabase
    .from('prime_metric_points')
    .select('period_id, metric_key, value_num, disclosure_status, source_url, source_note')
    .in('period_id', periodIds)
    .returns<PrimeMetricPointRow[]>()

  return buildPrimeDashboardDataFromRows({
    windowQuarters,
    companyRows: companyRows ?? [],
    periodRows: periodRows ?? [],
    metricRows: metricRows ?? [],
  })
}
