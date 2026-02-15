import {describe, expect, it} from 'bun:test'

import {classifyDefenseMoneyBucket} from './taxonomy'

describe('classifyDefenseMoneyBucket', () => {
  it('classifies munitions-oriented rows by description and psc', () => {
    const result = classifyDefenseMoneyBucket({
      pscCode: '1395',
      naicsCode: '332993',
      transactionDescription: 'Purchase of missile propulsion and warhead components',
    })

    expect(result.primary).toBe('munitions')
    expect(result.tags.includes('munitions')).toBe(true)
  })

  it('classifies ai/ml rows by keyword and NAICS', () => {
    const result = classifyDefenseMoneyBucket({
      pscCode: 'D302',
      naicsCode: '541715',
      transactionDescription: 'Machine learning and computer vision support for targeting',
    })

    expect(result.primary).toBe('ai_ml')
    expect(result.tags[0]).toBe('ai_ml')
  })

  it('falls back deterministically when no signals match', () => {
    const result = classifyDefenseMoneyBucket({
      pscCode: null,
      naicsCode: null,
      transactionDescription: 'General support services',
    })

    expect(result.primary).toBe('c5isr')
    expect(result.tags).toEqual(['c5isr'])
  })
})
