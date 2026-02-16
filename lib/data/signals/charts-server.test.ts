import {describe, expect, it} from 'bun:test'

import {buildDefenseMoneyChartsDataFromRows} from './charts-server'
import type {DefenseMoneyBucket, DefenseMoneyMacroContext, DefenseMoneyMarketQuote, DefenseMoneyRollup} from './types'

const awards: Array<{actionDate: string; transactionAmount: number; recipientName: string; awardId: string; sourceUrl: string; bucketPrimary: DefenseMoneyBucket}> = [
  {
    actionDate: '2026-02-09',
    transactionAmount: 100,
    recipientName: 'Company A',
    awardId: 'A-1',
    sourceUrl: 'https://example.com/a1',
    bucketPrimary: 'ai_ml',
  },
  {
    actionDate: '2026-02-10',
    transactionAmount: 300,
    recipientName: 'Company B',
    awardId: 'B-1',
    sourceUrl: 'https://example.com/b1',
    bucketPrimary: 'munitions',
  },
  {
    actionDate: '2026-02-11',
    transactionAmount: 200,
    recipientName: 'Company A',
    awardId: 'A-2',
    sourceUrl: 'https://example.com/a2',
    bucketPrimary: 'ai_ml',
  },
]

const weeklyRollups: DefenseMoneyRollup[] = [
  {
    periodType: 'week',
    periodStart: '2026-02-02',
    periodEnd: '2026-02-08',
    totalObligations: 250,
    awardCount: 2,
    top5Concentration: 0.52,
    categoryShare: {
      ai_ml: 0.25,
      c5isr: 0.2,
      space: 0.05,
      autonomy: 0.08,
      cyber: 0.1,
      munitions: 0.2,
      ew: 0.07,
      counter_uas: 0.05,
    },
    topRecipients: [{recipientName: 'Company A', amount: 130, share: 0.52}],
  },
  {
    periodType: 'week',
    periodStart: '2026-02-09',
    periodEnd: '2026-02-15',
    totalObligations: 600,
    awardCount: 3,
    top5Concentration: 0.6,
    categoryShare: {
      ai_ml: 0.5,
      c5isr: 0.1,
      space: 0.05,
      autonomy: 0.05,
      cyber: 0.05,
      munitions: 0.2,
      ew: 0.03,
      counter_uas: 0.02,
    },
    topRecipients: [{recipientName: 'Company A', amount: 300, share: 0.5}],
  },
]

const monthlyRollups: DefenseMoneyRollup[] = [
  {
    periodType: 'month',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    totalObligations: 1000,
    awardCount: 10,
    top5Concentration: 0.48,
    categoryShare: {
      ai_ml: 0.2,
      c5isr: 0.2,
      space: 0.1,
      autonomy: 0.1,
      cyber: 0.1,
      munitions: 0.15,
      ew: 0.1,
      counter_uas: 0.05,
    },
    topRecipients: [{recipientName: 'Company A', amount: 220, share: 0.22}],
  },
  {
    periodType: 'month',
    periodStart: '2026-02-01',
    periodEnd: '2026-02-28',
    totalObligations: 1500,
    awardCount: 12,
    top5Concentration: 0.55,
    categoryShare: {
      ai_ml: 0.33,
      c5isr: 0.12,
      space: 0.08,
      autonomy: 0.07,
      cyber: 0.09,
      munitions: 0.18,
      ew: 0.08,
      counter_uas: 0.05,
    },
    topRecipients: [{recipientName: 'Company B', amount: 300, share: 0.2}],
  },
]

const marketQuotes: DefenseMoneyMarketQuote[] = [
  {
    ticker: 'LMT',
    tradeDate: '2026-02-10',
    price: 100,
    changeNum: null,
    changePercent: null,
    high: null,
    low: null,
    open: null,
    previousClose: null,
    sourceUrl: 'https://example.com/lmt-1',
    contextHeadline: null,
    contextUrl: null,
  },
  {
    ticker: 'LMT',
    tradeDate: '2026-02-11',
    price: 110,
    changeNum: null,
    changePercent: null,
    high: null,
    low: null,
    open: null,
    previousClose: null,
    sourceUrl: 'https://example.com/lmt-2',
    contextHeadline: 'LMT context',
    contextUrl: 'https://example.com/lmt-news',
  },
]

const macro: DefenseMoneyMacroContext = {
  effectiveWeekStart: '2026-02-09',
  headline: 'Macro',
  summary: 'Summary',
  soWhat: 'So what',
  sourceLabel: 'Source',
  sourceUrl: 'https://example.com/macro',
  tags: ['budget'],
  isActive: true,
}

describe('buildDefenseMoneyChartsDataFromRows', () => {
  it('builds daily obligations points and recipient shares deterministically', () => {
    const result = buildDefenseMoneyChartsDataFromRows({
      targetDate: '2026-02-13',
      awardTransactions: awards,
      weeklyRollups,
      monthlyRollups,
      marketQuotes,
      activeMacro: macro,
      marketTickers: ['LMT', 'RTX'],
      latestDates: {
        awards: '2026-02-11',
        weeklyRollups: '2026-02-09',
        market: '2026-02-11',
        macro: '2026-02-09',
      },
    })

    const point = result.demandMomentum.points.find((entry) => entry.date === '2026-02-10')
    expect(point?.totalObligations).toBe(300)
    expect(point?.awardCount).toBe(1)

    expect(result.recipientLeaderboard.items[0]?.recipientName).toBe('Company A')
    expect(result.recipientLeaderboard.items[0]?.share).toBeCloseTo(0.5, 4)
    expect(result.weeklyCategoryShare.points.length).toBe(2)
    expect(result.weeklyCategoryShare.points[0]?.periodStart).toBe('2026-02-02')
  })

  it('computes market change fallback from price history when change_percent is missing', () => {
    const result = buildDefenseMoneyChartsDataFromRows({
      targetDate: '2026-02-13',
      awardTransactions: awards,
      weeklyRollups,
      monthlyRollups,
      marketQuotes,
      activeMacro: macro,
      marketTickers: ['LMT'],
      latestDates: {
        awards: '2026-02-11',
        weeklyRollups: '2026-02-09',
        market: '2026-02-11',
        macro: '2026-02-09',
      },
    })

    const lmt = result.primeSparklines.tickers.find((ticker) => ticker.ticker === 'LMT')
    expect(lmt?.latestChangePercent).toBeCloseTo(10, 4)
    expect(result.primeSparklines.summary.claims.length).toBeGreaterThan(0)
  })
})
