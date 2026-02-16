export const defenseMoneyBucketValues = ['ai_ml', 'c5isr', 'space', 'autonomy', 'cyber', 'munitions', 'ew', 'counter_uas'] as const

export type DefenseMoneyBucket = (typeof defenseMoneyBucketValues)[number]

export const defenseMoneyActionLensValues = ['build', 'sell', 'partner'] as const

export type DefenseMoneyActionLens = (typeof defenseMoneyActionLensValues)[number]

export const defenseMoneyBriefTimeframeValues = ['daily', 'weekly', 'monthly'] as const

export type DefenseMoneyBriefTimeframe = (typeof defenseMoneyBriefTimeframeValues)[number]

export const defenseMoneyGeneratedModeValues = ['deterministic', 'llm'] as const

export type DefenseMoneyGeneratedMode = (typeof defenseMoneyGeneratedModeValues)[number]

export type DefenseMoneyCitation = {
  id: string
  label: string
  url: string
  sourceLabel?: string
}

export type DefenseMoneyAwardTransaction = {
  generatedInternalId: string
  actionDate: string
  awardId: string
  recipientName: string
  awardingAgencyName: string
  transactionAmount: number
  naicsCode: string | null
  pscCode: string | null
  transactionDescription: string | null
  bucketPrimary: DefenseMoneyBucket
  bucketTags: DefenseMoneyBucket[]
  sourceUrl: string
  rawPayload?: Record<string, unknown>
}

export type DefenseMoneyMarketQuote = {
  ticker: string
  tradeDate: string
  price: number | null
  changeNum: number | null
  changePercent: number | null
  high: number | null
  low: number | null
  open: number | null
  previousClose: number | null
  sourceUrl: string | null
  contextHeadline: string | null
  contextUrl: string | null
  rawPayload?: Record<string, unknown>
}

export type DefenseMoneyRollup = {
  periodType: 'week' | 'month'
  periodStart: string
  periodEnd: string
  totalObligations: number
  awardCount: number
  top5Concentration: number
  categoryShare: Record<DefenseMoneyBucket, number>
  topRecipients: Array<{
    recipientName: string
    amount: number
    share: number
  }>
  payload?: Record<string, unknown>
}

export type DefenseMoneyMacroContext = {
  effectiveWeekStart: string
  headline: string
  summary: string
  soWhat: string
  sourceLabel: string
  sourceUrl: string
  tags: string[]
  isActive: boolean
}

export type DefenseMoneyCard = {
  cardKey: string
  timeframe: DefenseMoneyBriefTimeframe
  briefDate: string
  headline: string
  summary: string
  soWhat: string
  actionLens: DefenseMoneyActionLens
  generatedMode: DefenseMoneyGeneratedMode
  citations: DefenseMoneyCitation[]
  payload: Record<string, unknown>
}

export type DefenseMoneySignalData = {
  generatedAt: string
  dailySpendPulse: DefenseMoneyCard | null
  primeMoves: DefenseMoneyCard | null
  newAwards: DefenseMoneyCard | null
  weeklyStructural: DefenseMoneyCard | null
  monthlyStructural: DefenseMoneyCard | null
  macroContext: DefenseMoneyCard | null
  staleData: {
    daily: boolean
    weekly: boolean
    monthly: boolean
    market: boolean
  }
}

export type DefenseMoneyRunStatus = {
  runId: string | null
  status: 'succeeded' | 'partial_failed' | 'failed'
  processedTransactions: number
  processedTickers: number
  processedBriefs: number
  warnings: string[]
  error: string | null
  targetDate: string
}

export type DefenseMoneySyncOptions = {
  targetDate?: string
  triggerSource?: string
  includeMarket?: boolean
  includeLlm?: boolean
}

export type DefenseMoneyUsaspendingTransaction = {
  generatedInternalId: string
  actionDate: string
  awardId: string
  recipientName: string
  awardingAgencyName: string
  transactionAmount: number
  transactionDescription: string | null
  naicsCode: string | null
  pscCode: string | null
  sourceUrl: string
  rawPayload: Record<string, unknown>
}

export type DefenseMoneyTickerMove = {
  ticker: string
  quote: DefenseMoneyMarketQuote
}

export type DefenseMoneySummaryClaim = {
  id: string
  text: string
  citationIds: string[]
}

export type DefenseMoneyChartSummary = {
  headline: string
  actionLens: DefenseMoneyActionLens
  soWhat: string
  claims: DefenseMoneySummaryClaim[]
  citations: DefenseMoneyCitation[]
  sourceGapNote?: string
}

export type DefenseMoneyDemandMomentumPoint = {
  date: string
  totalObligations: number
  awardCount: number
  largestAwardAmount: number
}

export type DefenseMoneyWeeklyCategorySharePoint = {
  periodStart: string
  periodEnd: string
  totalObligations: number
  categoryShare: Record<DefenseMoneyBucket, number>
}

export type DefenseMoneyConcentrationPoint = {
  periodStart: string
  periodEnd: string
  totalObligations: number
  top5Concentration: number
}

export type DefenseMoneyRecipientLeaderboardItem = {
  recipientName: string
  totalObligations: number
  share: number
  awardCount: number
}

export type DefenseMoneySparklinePoint = {
  tradeDate: string
  price: number
}

export type DefenseMoneyPrimeSparkline = {
  ticker: string
  coverage: 'full' | 'partial'
  latestChangePercent: number | null
  points: DefenseMoneySparklinePoint[]
  citation: DefenseMoneyCitation | null
}

export type DefenseMoneyChartStaleFlags = {
  awards: boolean
  rollups: boolean
  market: boolean
  macro: boolean
}

export type DefenseMoneyThisWeekSignal = {
  summary: string
  soWhat: string
  actionLens: DefenseMoneyActionLens
  citations: DefenseMoneyCitation[]
  topBucket: DefenseMoneyBucket | null
  topBucketDelta: number | null
  concentrationDelta: number | null
}

export type DefenseMoneyChartData = {
  generatedAt: string
  targetDate: string
  demandMomentum: {
    points: DefenseMoneyDemandMomentumPoint[]
    fiveDayDelta: number | null
    summary: DefenseMoneyChartSummary
    insufficientData: boolean
  }
  weeklyCategoryShare: {
    points: DefenseMoneyWeeklyCategorySharePoint[]
    summary: DefenseMoneyChartSummary
    insufficientData: boolean
  }
  concentrationTrend: {
    weekly: DefenseMoneyConcentrationPoint[]
    monthly: DefenseMoneyConcentrationPoint[]
    weeklyDelta: number | null
    monthlyDelta: number | null
    summary: DefenseMoneyChartSummary
    insufficientData: boolean
  }
  recipientLeaderboard: {
    items: DefenseMoneyRecipientLeaderboardItem[]
    summary: DefenseMoneyChartSummary
    insufficientData: boolean
  }
  primeSparklines: {
    tickers: DefenseMoneyPrimeSparkline[]
    summary: DefenseMoneyChartSummary
    insufficientData: boolean
  }
  macroContext: DefenseMoneyMacroContext | null
  thisWeekSignal: DefenseMoneyThisWeekSignal | null
  staleData: DefenseMoneyChartStaleFlags
}

export type DefenseMoneyChartsResponse = {
  data: DefenseMoneyChartData
  meta: {
    date: string | null
    stale: DefenseMoneyChartStaleFlags
  }
}
