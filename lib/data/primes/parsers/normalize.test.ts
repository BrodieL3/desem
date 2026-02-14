import {describe, expect, it} from 'bun:test'

import {metricUnit, parseAmountToBillions, parseRatio, toPeriodLabel} from './normalize'

describe('parseAmountToBillions', () => {
  it('parses billions directly', () => {
    expect(parseAmountToBillions('$193.6 billion')).toBe(193.6)
  })

  it('converts millions to billions', () => {
    expect(parseAmountToBillions('950 million')).toBe(0.95)
  })

  it('converts trillions to billions', () => {
    expect(parseAmountToBillions('1.2 trillion')).toBe(1200)
  })

  it('returns null for invalid input', () => {
    expect(parseAmountToBillions('not a number')).toBeNull()
  })
})

describe('parseRatio', () => {
  it('parses ratios', () => {
    expect(parseRatio('1.63')).toBe(1.63)
    expect(parseRatio('book-to-bill 0.95')).toBe(0.95)
  })

  it('returns null for invalid ratio', () => {
    expect(parseRatio('none')).toBeNull()
  })
})

describe('helpers', () => {
  it('builds period labels', () => {
    expect(toPeriodLabel({fiscalYear: 2025, fiscalQuarter: 4})).toBe('Q4 2025')
  })

  it('returns metric units', () => {
    expect(metricUnit('book_to_bill')).toBe('ratio')
    expect(metricUnit('backlog_total_b')).toBe('usd_billion')
  })
})
