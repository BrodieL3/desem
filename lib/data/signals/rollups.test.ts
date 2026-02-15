import {describe, expect, it} from 'bun:test'

import {buildDefenseMoneyRollups} from './rollups'
import type {DefenseMoneyAwardTransaction} from './types'

const rows: DefenseMoneyAwardTransaction[] = [
  {
    generatedInternalId: 'a1',
    actionDate: '2026-02-10',
    awardId: 'AA-1',
    recipientName: 'Company A',
    awardingAgencyName: 'Department of Defense',
    transactionAmount: 100,
    naicsCode: '541715',
    pscCode: 'D302',
    transactionDescription: 'AI support',
    bucketPrimary: 'ai_ml',
    bucketTags: ['ai_ml'],
    sourceUrl: 'https://example.com/a1',
  },
  {
    generatedInternalId: 'a2',
    actionDate: '2026-02-11',
    awardId: 'AA-2',
    recipientName: 'Company B',
    awardingAgencyName: 'Department of Defense',
    transactionAmount: 300,
    naicsCode: '332993',
    pscCode: '1395',
    transactionDescription: 'Munitions production',
    bucketPrimary: 'munitions',
    bucketTags: ['munitions'],
    sourceUrl: 'https://example.com/a2',
  },
  {
    generatedInternalId: 'a3',
    actionDate: '2026-01-14',
    awardId: 'AA-3',
    recipientName: 'Company A',
    awardingAgencyName: 'Department of Defense',
    transactionAmount: 200,
    naicsCode: '541512',
    pscCode: 'D399',
    transactionDescription: 'Cyber services',
    bucketPrimary: 'cyber',
    bucketTags: ['cyber'],
    sourceUrl: 'https://example.com/a3',
  },
]

describe('buildDefenseMoneyRollups', () => {
  it('builds weekly and monthly aggregates', () => {
    const output = buildDefenseMoneyRollups(rows)

    expect(output.weekly.length).toBeGreaterThan(0)
    expect(output.monthly.length).toBeGreaterThan(0)

    const latestWeek = output.weekly[0]
    expect(latestWeek.awardCount).toBe(2)
    expect(latestWeek.totalObligations).toBe(400)
    expect(latestWeek.topRecipients[0]?.recipientName).toBe('Company B')
  })

  it('computes top-5 concentration and category share', () => {
    const output = buildDefenseMoneyRollups(rows)
    const latestMonth = output.monthly[0]

    expect(latestMonth.top5Concentration).toBeGreaterThan(0)
    expect(latestMonth.categoryShare.munitions).toBeGreaterThan(0)
    expect(latestMonth.categoryShare.ai_ml).toBeGreaterThan(0)
  })
})
