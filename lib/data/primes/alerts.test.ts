import {describe, expect, it} from 'bun:test'

import {buildPrimeAlerts} from './alerts'

import type {PrimeTableRow} from './types'

function makeRow(input: {
  ticker: PrimeTableRow['ticker']
  periodLabel: string
  periodEnd: string
  backlog: number | null
  bookToBill: number | null
}): PrimeTableRow {
  return {
    ticker: input.ticker,
    companyName: input.ticker,
    periodLabel: input.periodLabel,
    periodEnd: input.periodEnd,
    backlogTotalB: input.backlog,
    bookToBill: input.bookToBill,
    revenueB: null,
    ordersB: null,
    disclosureNotes: [],
    sourceLinks: ['https://example.com/filing'],
  }
}

describe('buildPrimeAlerts', () => {
  it('raises book-to-bill and backlog decline warnings', () => {
    const alerts = buildPrimeAlerts([
      makeRow({ticker: 'LMT', periodLabel: 'Q4 2025', periodEnd: '2025-12-31', backlog: 100, bookToBill: 0.9}),
      makeRow({ticker: 'LMT', periodLabel: 'Q4 2024', periodEnd: '2024-12-31', backlog: 120, bookToBill: 1.1}),
    ])

    expect(alerts.some((alert) => alert.rule === 'book_to_bill_below_1' && alert.ticker === 'LMT')).toBe(true)
    expect(alerts.some((alert) => alert.rule === 'backlog_yoy_decline' && alert.ticker === 'LMT')).toBe(true)
  })

  it('raises disclosure gap alerts for missing latest values', () => {
    const alerts = buildPrimeAlerts([
      makeRow({ticker: 'RTX', periodLabel: 'Q4 2025', periodEnd: '2025-12-31', backlog: null, bookToBill: null}),
    ])

    const gapAlerts = alerts.filter((alert) => alert.rule === 'disclosure_gap' && alert.ticker === 'RTX')
    expect(gapAlerts.length).toBe(2)
  })
})
