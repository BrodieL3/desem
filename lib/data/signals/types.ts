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
