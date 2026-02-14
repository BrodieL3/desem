export const primeTickerValues = ['LMT', 'RTX', 'BA', 'GD', 'NOC'] as const

export type PrimeTicker = (typeof primeTickerValues)[number]

export type PrimeColorToken = `chart-${1 | 2 | 3 | 4 | 5}`

export const primeMetricKeyValues = ['backlog_total_b', 'book_to_bill', 'revenue_b', 'orders_b'] as const

export type PrimeMetricKey = (typeof primeMetricKeyValues)[number]

export const primeDisclosureStatusValues = ['disclosed', 'not_disclosed'] as const

export type PrimeDisclosureStatus = (typeof primeDisclosureStatusValues)[number]

export const primeFilingTypeValues = ['10-Q', '10-K', '8-K', 'IR_RELEASE'] as const

export type PrimeFilingType = (typeof primeFilingTypeValues)[number]

export const primeAlertSeverityValues = ['info', 'warning', 'critical'] as const

export type PrimeAlertSeverity = (typeof primeAlertSeverityValues)[number]

export const primeAlertRuleValues = ['book_to_bill_below_1', 'backlog_yoy_decline', 'disclosure_gap'] as const

export type PrimeAlertRule = (typeof primeAlertRuleValues)[number]

export type PrimeCompanyDescriptor = {
  ticker: PrimeTicker
  name: string
  colorToken: PrimeColorToken
}

export type PrimeAlert = {
  id: string
  ticker: PrimeTicker
  periodLabel: string
  severity: PrimeAlertSeverity
  rule: PrimeAlertRule
  message: string
  sourceUrl: string | null
}

export type PrimeSeriesPoint = {
  ticker: PrimeTicker
  periodEnd: string
  periodLabel: string
  value: number | null
  disclosureStatus: PrimeDisclosureStatus
  sourceUrl: string | null
}

export type PrimeMetricSeries = {
  metricKey: PrimeMetricKey
  points: PrimeSeriesPoint[]
}

export type PrimeTableRow = {
  ticker: PrimeTicker
  companyName: string
  periodEnd: string
  periodLabel: string
  backlogTotalB: number | null
  bookToBill: number | null
  revenueB: number | null
  ordersB: number | null
  disclosureNotes: string[]
  sourceLinks: string[]
}

export type PrimeSourceCitation = {
  id: string
  filingType: PrimeFilingType
  filingDate: string
  sourceUrl: string
}

export type PrimeDashboardData = {
  generatedAt: string
  windowQuarters: number
  companies: PrimeCompanyDescriptor[]
  alerts: PrimeAlert[]
  series: PrimeMetricSeries[]
  tableRows: PrimeTableRow[]
  sources: PrimeSourceCitation[]
  staleData: boolean
}

export type PrimeDashboardResponse = {
  data: PrimeDashboardData
  meta: {
    countRows: number
    windowQuarters: number
  }
}

export type PrimeDashboardOptions = {
  windowQuarters?: number
}

export type PrimeCompanyRow = {
  id: string
  ticker: string
  name: string
  display_order: number
  is_active: boolean
}

export type PrimeReportingPeriodRow = {
  id: string
  company_id: string
  fiscal_year: number
  fiscal_quarter: number
  period_end: string
  filing_type: string
  filing_date: string
  source_url: string
  updated_at?: string | null
}

export type PrimeMetricPointRow = {
  period_id: string
  metric_key: string
  value_num: number | null
  disclosure_status: string
  source_url: string | null
  source_note: string | null
}

export type PrimeBackfillMetric = {
  value: number | null
  status: PrimeDisclosureStatus
  unit?: string
  sourceUrl?: string
  sourceNote?: string
}

export type PrimeBackfillPeriod = {
  fiscalYear: number
  fiscalQuarter: number
  periodEnd: string
  filingType: PrimeFilingType
  filingDate: string
  sourceUrl: string
  accessionNo?: string
  notes?: string
  metrics: Partial<Record<PrimeMetricKey, PrimeBackfillMetric>>
}

export type PrimeBackfillCompany = {
  ticker: PrimeTicker
  name: string
  cik: string
  colorToken: PrimeColorToken
  periods: PrimeBackfillPeriod[]
}

export type PrimeBackfillDocument = {
  version: string
  generatedAt: string
  companies: PrimeBackfillCompany[]
}

export type PrimeFilingCandidate = {
  accessionNo: string
  filingType: PrimeFilingType | null
  filedAt: string
  reportDate: string | null
  primaryDocument: string | null
  filingUrl: string | null
}
