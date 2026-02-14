import {describe, expect, it} from 'bun:test'

import {buildPrimeDashboardDataFromRows} from './server'

import type {PrimeCompanyRow, PrimeMetricPointRow, PrimeReportingPeriodRow} from './types'

const companies: PrimeCompanyRow[] = [
  {
    id: 'c1',
    ticker: 'LMT',
    name: 'Lockheed Martin',
    display_order: 1,
    is_active: true,
  },
  {
    id: 'c2',
    ticker: 'RTX',
    name: 'RTX',
    display_order: 2,
    is_active: true,
  },
]

const periods: PrimeReportingPeriodRow[] = [
  {
    id: 'p1',
    company_id: 'c1',
    fiscal_year: 2025,
    fiscal_quarter: 4,
    period_end: '2025-12-31',
    filing_type: '8-K',
    filing_date: '2026-01-29',
    source_url: 'https://example.com/lmt-q4',
  },
  {
    id: 'p2',
    company_id: 'c1',
    fiscal_year: 2025,
    fiscal_quarter: 3,
    period_end: '2025-09-30',
    filing_type: '10-Q',
    filing_date: '2025-10-25',
    source_url: 'https://example.com/lmt-q3',
  },
  {
    id: 'p3',
    company_id: 'c1',
    fiscal_year: 2025,
    fiscal_quarter: 2,
    period_end: '2025-06-30',
    filing_type: '10-Q',
    filing_date: '2025-07-25',
    source_url: 'https://example.com/lmt-q2',
  },
  {
    id: 'p4',
    company_id: 'c2',
    fiscal_year: 2025,
    fiscal_quarter: 4,
    period_end: '2025-12-31',
    filing_type: '8-K',
    filing_date: '2026-01-27',
    source_url: 'https://example.com/rtx-q4',
  },
  {
    id: 'p5',
    company_id: 'c2',
    fiscal_year: 2025,
    fiscal_quarter: 3,
    period_end: '2025-09-30',
    filing_type: '10-Q',
    filing_date: '2025-10-24',
    source_url: 'https://example.com/rtx-q3',
  },
]

const metrics: PrimeMetricPointRow[] = [
  {
    period_id: 'p1',
    metric_key: 'backlog_total_b',
    value_num: 193.6,
    disclosure_status: 'disclosed',
    source_url: 'https://example.com/lmt-q4',
    source_note: 'Backlog disclosed',
  },
  {
    period_id: 'p1',
    metric_key: 'book_to_bill',
    value_num: 0.95,
    disclosure_status: 'disclosed',
    source_url: 'https://example.com/lmt-q4',
    source_note: 'Book-to-bill disclosed',
  },
  {
    period_id: 'p4',
    metric_key: 'backlog_total_b',
    value_num: null,
    disclosure_status: 'not_disclosed',
    source_url: 'https://example.com/rtx-q4',
    source_note: 'Not disclosed',
  },
]

describe('buildPrimeDashboardDataFromRows', () => {
  it('limits to requested window per company and orders by period desc', () => {
    const dashboard = buildPrimeDashboardDataFromRows({
      windowQuarters: 2,
      companyRows: companies,
      periodRows: periods,
      metricRows: metrics,
      generatedAt: '2026-02-14T00:00:00.000Z',
    })

    expect(dashboard.tableRows.length).toBe(4)
    expect(dashboard.tableRows[0]?.periodLabel).toBe('Q4 2025')
    expect(dashboard.tableRows.every((row) => row.periodLabel === 'Q4 2025' || row.periodLabel === 'Q3 2025')).toBe(true)
  })

  it('preserves null values and emits disclosure gap alerts', () => {
    const dashboard = buildPrimeDashboardDataFromRows({
      windowQuarters: 2,
      companyRows: companies,
      periodRows: periods,
      metricRows: metrics,
      generatedAt: '2026-02-14T00:00:00.000Z',
    })

    const rtxQ4 = dashboard.tableRows.find((row) => row.ticker === 'RTX' && row.periodLabel === 'Q4 2025')

    expect(rtxQ4?.backlogTotalB).toBeNull()
    expect(rtxQ4?.bookToBill).toBeNull()
    expect(dashboard.alerts.some((alert) => alert.ticker === 'RTX' && alert.rule === 'disclosure_gap')).toBe(true)
  })
})
