import {describe, expect, it} from 'bun:test'

import {parsePrimeMetricsFromText} from './metrics-from-text'

describe('parsePrimeMetricsFromText', () => {
  it('extracts backlog and book-to-bill from typical earnings language', () => {
    const parsed = parsePrimeMetricsFromText(
      'Backlog of $193.6 billion. Book-to-bill ratio of 0.95. Revenue of $18.4 billion. Orders of $17.5 billion.'
    )

    expect(parsed.backlog_total_b?.value).toBe(193.6)
    expect(parsed.backlog_total_b?.status).toBe('disclosed')
    expect(parsed.book_to_bill?.value).toBe(0.95)
    expect(parsed.revenue_b?.value).toBe(18.4)
    expect(parsed.orders_b?.value).toBe(17.5)
  })

  it('marks values as not disclosed when missing', () => {
    const parsed = parsePrimeMetricsFromText('Revenue reached $12.1 billion for the period.')

    expect(parsed.backlog_total_b?.status).toBe('not_disclosed')
    expect(parsed.book_to_bill?.status).toBe('not_disclosed')
    expect(parsed.revenue_b?.status).toBe('disclosed')
    expect(parsed.orders_b?.status).toBe('not_disclosed')
  })

  it('handles empty payloads', () => {
    const parsed = parsePrimeMetricsFromText('')

    expect(parsed.backlog_total_b?.status).toBe('not_disclosed')
    expect(parsed.book_to_bill?.status).toBe('not_disclosed')
    expect(parsed.revenue_b?.status).toBe('not_disclosed')
    expect(parsed.orders_b?.status).toBe('not_disclosed')
  })
})
