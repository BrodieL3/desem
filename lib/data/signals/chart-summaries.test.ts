import {describe, expect, it} from 'bun:test'

import {buildDeterministicChartSummary, resolveActionLensFromBucket, resolveActionLensFromMomentum} from './chart-summaries'

describe('resolveActionLensFromBucket', () => {
  it('maps build/sell/partner buckets as expected', () => {
    expect(resolveActionLensFromBucket('ai_ml')).toBe('build')
    expect(resolveActionLensFromBucket('counter_uas')).toBe('sell')
    expect(resolveActionLensFromBucket('c5isr')).toBe('partner')
  })
})

describe('resolveActionLensFromMomentum', () => {
  it('prefers strongest positive bucket momentum', () => {
    expect(
      resolveActionLensFromMomentum({
        ai_ml: 0.01,
        munitions: 0.03,
      })
    ).toBe('sell')
  })

  it('returns partner when momentum is flat or negative', () => {
    expect(
      resolveActionLensFromMomentum({
        ai_ml: -0.02,
        c5isr: -0.01,
      })
    ).toBe('partner')
  })
})

describe('buildDeterministicChartSummary', () => {
  it('keeps only citation-backed claims', () => {
    const summary = buildDeterministicChartSummary({
      headline: 'Weekly category share',
      actionLens: 'build',
      soWhat: 'Prioritize acceleration.',
      claims: [
        {
          id: 'claim-a',
          text: 'Supported claim',
          citationIds: ['c-1'],
        },
        {
          id: 'claim-b',
          text: 'Unsupported claim',
          citationIds: ['missing'],
        },
      ],
      citations: [
        {
          id: 'c-1',
          label: 'Source A',
          url: 'https://example.com/a',
        },
      ],
    })

    expect(summary.claims.length).toBe(1)
    expect(summary.claims[0]?.id).toBe('claim-a')
    expect(summary.citations.length).toBe(1)
  })

  it('falls back to source-gap note when no claim has valid citations', () => {
    const summary = buildDeterministicChartSummary({
      headline: 'Prime sparklines',
      actionLens: 'partner',
      soWhat: 'Use as context only.',
      claims: [
        {
          id: 'claim-a',
          text: 'No support',
          citationIds: ['missing'],
        },
      ],
      citations: [],
    })

    expect(summary.claims.length).toBe(0)
    expect(summary.citations.length).toBe(0)
    expect(summary.sourceGapNote).toContain('Insufficient data')
  })
})
