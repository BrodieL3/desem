import {describe, expect, it} from 'bun:test'
import {renderToStaticMarkup} from 'react-dom/server'

import {MetricsTable} from './metrics-table'

import type {PrimeCompanyDescriptor, PrimeTableRow} from '@/lib/data/primes/types'

const companies: PrimeCompanyDescriptor[] = [
  {
    ticker: 'LMT',
    name: 'Lockheed Martin',
    colorToken: 'chart-1',
  },
]

const rows: PrimeTableRow[] = [
  {
    ticker: 'LMT',
    companyName: 'Lockheed Martin',
    periodEnd: '2025-12-31',
    periodLabel: 'Q4 2025',
    backlogTotalB: null,
    bookToBill: null,
    revenueB: null,
    ordersB: null,
    disclosureNotes: [],
    sourceLinks: [],
  },
]

describe('MetricsTable', () => {
  it('renders not disclosed badges for null values', () => {
    const markup = renderToStaticMarkup(<MetricsTable rows={rows} companies={companies} />)

    expect(markup).toContain('Not disclosed')
    expect(markup).toContain('Q4 2025')
  })
})
