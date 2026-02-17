import {readFile} from 'node:fs/promises'

import type {SupabaseClient} from '@supabase/supabase-js'

import {createSupabaseAdminClientFromEnv} from '@/lib/supabase/admin'

import {getDefenseMoneySignalsConfig} from './config'
import {generateGuardrailedImplication} from './implications'
import {loadMacroContextFromYaml, resolveActiveMacroContext, upsertMacroContextEntries} from './macro'
import {fetchDefenseGovDailyContracts} from './providers/defense-gov'
import {fetchFinnhubDailyQuotes, fetchFinnhubHistoricalCandles} from './providers/finnhub'
import {fetchAllSamGovOpportunities} from './providers/sam-gov'
import {fetchUsaspendingTransactions} from './providers/usaspending'
import {buildDefenseMoneyRollups, upsertDefenseMoneyRollups} from './rollups'
import {priorBusinessDayEt, shiftIsoDate} from './time'
import {classifyDefenseMoneyBucket} from './taxonomy'
import type {
  DefenseMoneyActionLens,
  DefenseMoneyAwardTransaction,
  DefenseMoneyCard,
  DefenseMoneyCitation,
  DefenseMoneyMacroContext,
  DefenseMoneyMarketQuote,
  DefenseMoneyRollup,
  DefenseMoneyRunStatus,
  DefenseMoneySyncOptions,
  DefenseMoneyTickerMove,
  DefenseMoneyUsaspendingTransaction,
} from './types'

type DefenseMoneyRunRow = {
  id: string
}

type DefenseMoneyTransactionRow = {
  generated_internal_id: string
  action_date: string
  award_id: string
  recipient_name: string
  awarding_agency_name: string
  transaction_amount: number
  naics_code: string | null
  psc_code: string | null
  transaction_description: string | null
  bucket_primary: DefenseMoneyAwardTransaction['bucketPrimary']
  bucket_tags: string[] | null
  source_url: string
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function deterministicActionLensFromBucket(bucket: string): DefenseMoneyActionLens {
  if (bucket === 'munitions' || bucket === 'counter_uas' || bucket === 'ew') {
    return 'sell'
  }

  if (bucket === 'ai_ml' || bucket === 'autonomy' || bucket === 'space') {
    return 'build'
  }

  return 'partner'
}

function topTransactionsByAmount(rows: DefenseMoneyAwardTransaction[], limit: number) {
  return [...rows].sort((left, right) => right.transactionAmount - left.transactionAmount).slice(0, limit)
}

function citationFromTransaction(transaction: DefenseMoneyAwardTransaction): DefenseMoneyCitation {
  return {
    id: transaction.generatedInternalId,
    label: `${transaction.recipientName} · ${toCurrency(transaction.transactionAmount)} · ${transaction.actionDate}`,
    url: transaction.sourceUrl,
    sourceLabel: 'USAspending',
  }
}

function citationFromQuote(quote: DefenseMoneyMarketQuote): DefenseMoneyCitation {
  return {
    id: `quote-${quote.ticker}-${quote.tradeDate}`,
    label: `${quote.ticker} · ${quote.changePercent === null ? 'N/D' : `${quote.changePercent.toFixed(2)}%`}`,
    url: quote.contextUrl ?? quote.sourceUrl ?? 'https://finnhub.io',
    sourceLabel: quote.contextUrl ? 'Finnhub Company News' : 'Finnhub Quote',
  }
}

function asMarketMoves(quotes: DefenseMoneyMarketQuote[]): DefenseMoneyTickerMove[] {
  return quotes
    .filter((quote) => quote.changePercent !== null)
    .sort((left, right) => Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0))
    .map((quote) => ({
      ticker: quote.ticker,
      quote,
    }))
}

async function beginDefenseMoneyRun(input: {
  supabase: SupabaseClient
  targetDate: string
  triggerSource: string
}) {
  const {data, error} = await input.supabase
    .from('defense_money_runs')
    .insert({
      trigger_source: input.triggerSource,
      status: 'running',
      target_date: input.targetDate,
    })
    .select('id')
    .single<DefenseMoneyRunRow>()

  if (error || !data) {
    throw new Error(`Unable to start defense money run: ${error?.message ?? 'missing run id'}`)
  }

  return data.id
}

async function completeDefenseMoneyRun(input: {
  supabase: SupabaseClient
  runId: string
  status: DefenseMoneyRunStatus['status']
  processedTransactions: number
  processedTickers: number
  processedBriefs: number
  warnings: string[]
  error?: string | null
}) {
  const {error} = await input.supabase
    .from('defense_money_runs')
    .update({
      status: input.status,
      processed_transactions: input.processedTransactions,
      processed_tickers: input.processedTickers,
      processed_briefs: input.processedBriefs,
      error_summary: input.error ?? (input.warnings.length > 0 ? input.warnings.join(' | ') : null),
      completed_at: new Date().toISOString(),
    })
    .eq('id', input.runId)

  if (error) {
    throw new Error(`Unable to complete defense money run ${input.runId}: ${error.message}`)
  }
}

function classifyTransactions(rows: DefenseMoneyUsaspendingTransaction[]): DefenseMoneyAwardTransaction[] {
  return rows.map((row) => {
    const classification = classifyDefenseMoneyBucket({
      pscCode: row.pscCode,
      naicsCode: row.naicsCode,
      transactionDescription: row.transactionDescription,
    })

    return {
      generatedInternalId: row.generatedInternalId,
      actionDate: row.actionDate,
      awardId: row.awardId,
      recipientName: row.recipientName,
      awardingAgencyName: row.awardingAgencyName,
      transactionAmount: row.transactionAmount,
      naicsCode: row.naicsCode,
      pscCode: row.pscCode,
      transactionDescription: row.transactionDescription,
      bucketPrimary: classification.primary,
      bucketTags: classification.tags,
      sourceUrl: row.sourceUrl,
      rawPayload: row.rawPayload,
    }
  })
}

async function upsertTransactions(input: {
  supabase: SupabaseClient
  runId: string | null
  rows: DefenseMoneyAwardTransaction[]
}) {
  if (input.rows.length === 0) {
    return 0
  }

  const payload = input.rows.map((row) => ({
    run_id: input.runId,
    generated_internal_id: row.generatedInternalId,
    action_date: row.actionDate,
    award_id: row.awardId,
    recipient_name: row.recipientName,
    awarding_agency_name: row.awardingAgencyName,
    transaction_amount: row.transactionAmount,
    naics_code: row.naicsCode,
    psc_code: row.pscCode,
    transaction_description: row.transactionDescription,
    bucket_primary: row.bucketPrimary,
    bucket_tags: row.bucketTags,
    source_url: row.sourceUrl,
    raw_payload: row.rawPayload ?? {},
  }))

  const {error} = await input.supabase.from('defense_money_award_transactions').upsert(payload, {
    onConflict: 'generated_internal_id',
  })

  if (error) {
    throw new Error(`Unable to upsert defense money transactions: ${error.message}`)
  }

  return payload.length
}

async function upsertQuotes(input: {
  supabase: SupabaseClient
  runId: string | null
  rows: DefenseMoneyMarketQuote[]
}) {
  if (input.rows.length === 0) {
    return 0
  }

  const payload = input.rows.map((row) => ({
    run_id: input.runId,
    trade_date: row.tradeDate,
    ticker: row.ticker,
    price: row.price,
    change_num: row.changeNum,
    change_percent: row.changePercent,
    high: row.high,
    low: row.low,
    open: row.open,
    previous_close: row.previousClose,
    source_url: row.sourceUrl,
    context_headline: row.contextHeadline,
    context_url: row.contextUrl,
    raw_payload: row.rawPayload ?? {},
  }))

  const {error} = await input.supabase.from('defense_money_market_quotes').upsert(payload, {
    onConflict: 'trade_date,ticker',
  })

  if (error) {
    throw new Error(`Unable to upsert defense money market quotes: ${error.message}`)
  }

  return payload.length
}

async function readTrailingTransactions(input: {
  supabase: SupabaseClient
  targetDate: string
  days: number
}) {
  const startDate = shiftIsoDate(input.targetDate, -Math.max(1, input.days))
  const {data, error} = await input.supabase
    .from('defense_money_award_transactions')
    .select(
      'generated_internal_id, action_date, award_id, recipient_name, awarding_agency_name, transaction_amount, naics_code, psc_code, transaction_description, bucket_primary, bucket_tags, source_url'
    )
    .gte('action_date', startDate)
    .lte('action_date', input.targetDate)
    .returns<DefenseMoneyTransactionRow[]>()

  if (error) {
    throw new Error(`Unable to read trailing defense money transactions: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    generatedInternalId: row.generated_internal_id,
    actionDate: row.action_date,
    awardId: row.award_id,
    recipientName: row.recipient_name,
    awardingAgencyName: row.awarding_agency_name,
    transactionAmount: Number(row.transaction_amount),
    naicsCode: row.naics_code,
    pscCode: row.psc_code,
    transactionDescription: row.transaction_description,
    bucketPrimary: row.bucket_primary,
    bucketTags: (row.bucket_tags ?? []) as DefenseMoneyAwardTransaction['bucketTags'],
    sourceUrl: row.source_url,
  }))
}

async function upsertCards(input: {
  supabase: SupabaseClient
  runId: string
  cards: DefenseMoneyCard[]
}) {
  if (input.cards.length === 0) {
    return 0
  }

  const rows = input.cards.map((card) => ({
    run_id: input.runId,
    brief_date: card.briefDate,
    timeframe: card.timeframe,
    card_key: card.cardKey,
    generated_mode: card.generatedMode,
    action_lens: card.actionLens,
    summary: card.summary,
    so_what: card.soWhat,
    citations: card.citations,
    payload: {
      ...card.payload,
      headline: card.headline,
    },
  }))

  const {error} = await input.supabase.from('defense_money_briefs').upsert(rows, {
    onConflict: 'brief_date,timeframe,card_key',
  })

  if (error) {
    throw new Error(`Unable to upsert defense money briefs: ${error.message}`)
  }

  return rows.length
}

async function buildDailySpendPulseCard(input: {
  targetDate: string
  transactions: DefenseMoneyAwardTransaction[]
  llmEnabled: boolean
  llmModel: string
}): Promise<DefenseMoneyCard | null> {
  if (input.transactions.length === 0) {
    return null
  }

  const total = input.transactions.reduce((sum, row) => sum + row.transactionAmount, 0)
  const largest = topTransactionsByAmount(input.transactions, 1)[0]

  if (!largest) {
    return null
  }

  const citations = topTransactionsByAmount(input.transactions, 3).map(citationFromTransaction)

  const summary = `${toCurrency(total)} across ${input.transactions.length} DoD obligations. Largest: ${largest.recipientName} (${toCurrency(largest.transactionAmount)}).`
  const deterministicSoWhat = `Prioritize ${largest.bucketPrimary.replaceAll('_', '/')} pipeline positioning; near-term demand is concentrating in awards tied to this category.`

  const implication = await generateGuardrailedImplication({
    headline: 'New Money',
    summary,
    deterministicSoWhat,
    citations,
    model: input.llmModel,
    llmEnabled: input.llmEnabled,
  })

  return {
    cardKey: 'daily_spend_pulse',
    timeframe: 'daily',
    briefDate: input.targetDate,
    headline: 'New Money',
    summary: implication.summary,
    soWhat: implication.soWhat,
    actionLens: implication.actionLens,
    generatedMode: implication.generatedMode,
    citations,
    payload: {
      totalObligations: Number(total.toFixed(2)),
      awardCount: input.transactions.length,
      largestAward: {
        recipientName: largest.recipientName,
        amount: largest.transactionAmount,
        awardId: largest.awardId,
        bucket: largest.bucketPrimary,
      },
    },
  }
}

async function buildPrimeMovesCard(input: {
  targetDate: string
  quotes: DefenseMoneyMarketQuote[]
  llmEnabled: boolean
  llmModel: string
}): Promise<DefenseMoneyCard | null> {
  const movers = asMarketMoves(input.quotes).slice(0, 5)

  if (movers.length === 0) {
    return null
  }

  const topMover = movers[0]

  if (!topMover) {
    return null
  }

  const summary = movers
    .map((mover) => `${mover.ticker} ${mover.quote.changePercent?.toFixed(2) ?? '0.00'}%`)
    .join(' · ')

  const citations = movers.map((mover) => citationFromQuote(mover.quote))
  const deterministicSoWhat = `Use top mover context to sharpen near-term capture messaging around program sustainment, production ramps, or policy-linked demand.`

  const implication = await generateGuardrailedImplication({
    headline: 'Prime Moves',
    summary,
    deterministicSoWhat,
    citations,
    model: input.llmModel,
    llmEnabled: input.llmEnabled,
  })

  return {
    cardKey: 'prime_moves',
    timeframe: 'daily',
    briefDate: input.targetDate,
    headline: 'Prime Moves',
    summary: implication.summary,
    soWhat: implication.soWhat,
    actionLens: implication.actionLens,
    generatedMode: implication.generatedMode,
    citations,
    payload: {
      movers: movers.map((mover) => ({
        ticker: mover.ticker,
        changePercent: mover.quote.changePercent,
        changeNum: mover.quote.changeNum,
        price: mover.quote.price,
        contextHeadline: mover.quote.contextHeadline,
        contextUrl: mover.quote.contextUrl,
      })),
    },
  }
}

async function buildNewAwardsCard(input: {
  targetDate: string
  transactions: DefenseMoneyAwardTransaction[]
  llmEnabled: boolean
  llmModel: string
}): Promise<DefenseMoneyCard | null> {
  const topAwards = topTransactionsByAmount(input.transactions, 5)

  if (topAwards.length === 0) {
    return null
  }

  const summary = topAwards
    .slice(0, 3)
    .map((award) => `${award.recipientName} ${toCurrency(award.transactionAmount)} (${award.bucketPrimary.replaceAll('_', '/')})`)
    .join(' · ')

  const citations = topAwards.map(citationFromTransaction)
  const deterministicSoWhat = `Target BD outreach where repeated recipients and bucket concentration indicate immediate subcontracting or displacement opportunities.`

  const implication = await generateGuardrailedImplication({
    headline: 'New awards you should know about',
    summary,
    deterministicSoWhat,
    citations,
    model: input.llmModel,
    llmEnabled: input.llmEnabled,
  })

  return {
    cardKey: 'new_awards',
    timeframe: 'daily',
    briefDate: input.targetDate,
    headline: 'New awards you should know about',
    summary: implication.summary,
    soWhat: implication.soWhat,
    actionLens: implication.actionLens,
    generatedMode: implication.generatedMode,
    citations,
    payload: {
      awards: topAwards.map((award) => ({
        awardId: award.awardId,
        recipientName: award.recipientName,
        amount: award.transactionAmount,
        bucket: award.bucketPrimary,
        description: award.transactionDescription,
      })),
    },
  }
}

function structuralCardFromRollup(input: {
  cardKey: 'weekly_structural' | 'monthly_structural'
  headline: string
  timeframe: 'weekly' | 'monthly'
  rollup: DefenseMoneyRollup | null
}): DefenseMoneyCard | null {
  const rollup = input.rollup

  if (!rollup) {
    return null
  }

  const topBucket = Object.entries(rollup.categoryShare)
    .sort((left, right) => right[1] - left[1])[0] as [string, number] | undefined

  const topRecipient = rollup.topRecipients[0]
  const summary = `${toCurrency(rollup.totalObligations)} across ${rollup.awardCount} awards. Top-5 concentration: ${percent(rollup.top5Concentration)}.`
  const soWhat = topBucket
    ? `${topBucket[0].replaceAll('_', '/')} captured ${percent(topBucket[1])} share; align build and capture plans to this demand concentration.`
    : 'Monitor recipient concentration and category share shifts for near-term go-to-market positioning.'

  const citations: DefenseMoneyCitation[] = topRecipient
    ? [
        {
          id: `${rollup.periodType}-${rollup.periodStart}-top-recipient`,
          label: `${topRecipient.recipientName} · ${toCurrency(topRecipient.amount)} · ${percent(topRecipient.share)}`,
          url: 'https://api.usaspending.gov/docs/endpoints',
          sourceLabel: 'USAspending',
        },
      ]
    : []

  return {
    cardKey: input.cardKey,
    timeframe: input.timeframe,
    briefDate: rollup.periodStart,
    headline: input.headline,
    summary,
    soWhat,
    actionLens: topBucket ? deterministicActionLensFromBucket(topBucket[0]) : 'sell',
    generatedMode: 'deterministic',
    citations,
    payload: {
      ...rollup,
    },
  }
}

function macroContextCard(input: {entry: DefenseMoneyMacroContext | null}): DefenseMoneyCard | null {
  if (!input.entry) {
    return null
  }

  return {
    cardKey: 'macro_context',
    timeframe: 'weekly',
    briefDate: input.entry.effectiveWeekStart,
    headline: input.entry.headline,
    summary: input.entry.summary,
    soWhat: input.entry.soWhat,
    actionLens: 'sell',
    generatedMode: 'deterministic',
    citations: [
      {
        id: `macro-${input.entry.effectiveWeekStart}`,
        label: input.entry.sourceLabel,
        url: input.entry.sourceUrl,
        sourceLabel: input.entry.sourceLabel,
      },
    ],
    payload: {
      tags: input.entry.tags,
      effectiveWeekStart: input.entry.effectiveWeekStart,
    },
  }
}

async function buildCards(input: {
  targetDate: string
  transactions: DefenseMoneyAwardTransaction[]
  quotes: DefenseMoneyMarketQuote[]
  rollups: {
    weekly: DefenseMoneyRollup[]
    monthly: DefenseMoneyRollup[]
  }
  macro: DefenseMoneyMacroContext | null
  llmEnabled: boolean
  llmModel: string
}) {
  const [dailySpendPulse, primeMoves, newAwards] = await Promise.all([
    buildDailySpendPulseCard({
      targetDate: input.targetDate,
      transactions: input.transactions,
      llmEnabled: input.llmEnabled,
      llmModel: input.llmModel,
    }),
    buildPrimeMovesCard({
      targetDate: input.targetDate,
      quotes: input.quotes,
      llmEnabled: input.llmEnabled,
      llmModel: input.llmModel,
    }),
    buildNewAwardsCard({
      targetDate: input.targetDate,
      transactions: input.transactions,
      llmEnabled: input.llmEnabled,
      llmModel: input.llmModel,
    }),
  ])

  const weeklyStructural = structuralCardFromRollup({
    cardKey: 'weekly_structural',
    headline: 'Weekly structural shifts',
    timeframe: 'weekly',
    rollup: input.rollups.weekly[0] ?? null,
  })

  const monthlyStructural = structuralCardFromRollup({
    cardKey: 'monthly_structural',
    headline: 'Monthly structural shifts',
    timeframe: 'monthly',
    rollup: input.rollups.monthly[0] ?? null,
  })

  const macroContext = macroContextCard({
    entry: input.macro,
  })

  return [dailySpendPulse, primeMoves, newAwards, weeklyStructural, monthlyStructural, macroContext].filter(
    (card): card is DefenseMoneyCard => card !== null
  )
}

export async function syncDefenseMoneySignals(options: DefenseMoneySyncOptions = {}): Promise<DefenseMoneyRunStatus> {
  const config = getDefenseMoneySignalsConfig()
  const targetDate = compact(options.targetDate) || priorBusinessDayEt()

  if (!config.enabled) {
    return {
      runId: null,
      status: 'succeeded',
      processedTransactions: 0,
      processedTickers: 0,
      processedBriefs: 0,
      warnings: ['DATA_MONEY_SIGNALS_ENABLED is false; sync skipped.'],
      error: null,
      targetDate,
    }
  }

  const supabase = createSupabaseAdminClientFromEnv()
  const warnings: string[] = []
  let runId: string | null = null

  try {
    runId = await beginDefenseMoneyRun({
      supabase,
      targetDate,
      triggerSource: options.triggerSource ?? 'script:sync-defense-money-signals',
    })

    let macroEntries: DefenseMoneyMacroContext[] = []

    try {
      await readFile(config.macroSnapshotPath, 'utf8')
      macroEntries = await loadMacroContextFromYaml(config.macroSnapshotPath)
      await upsertMacroContextEntries(supabase, macroEntries)
    } catch (error) {
      warnings.push(`Macro context load failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    }

    const {transactions: fetchedTransactions, warnings: usaspendingWarnings} = await fetchUsaspendingTransactions({
      apiBaseUrl: config.usaspendingApiBaseUrl,
      actionDate: targetDate,
      awardingAgencies: config.allowedAwardingAgencies,
      minTransactionUsd: config.minTransactionUsd,
      maxPages: config.maxTransactionPages,
    })

    warnings.push(...usaspendingWarnings)

    const classifiedTransactions = classifyTransactions(fetchedTransactions)
    const processedTransactions = await upsertTransactions({
      supabase,
      runId,
      rows: classifiedTransactions,
    })

    const includeMarket = options.includeMarket ?? true
    let quotes: DefenseMoneyMarketQuote[] = []

    if (includeMarket) {
      const quoteResponse = await fetchFinnhubDailyQuotes({
        tickers: config.marketTickers,
        apiKey: config.finnhubApiKey,
      })

      quotes = quoteResponse.quotes
      warnings.push(...quoteResponse.warnings)

      await upsertQuotes({
        supabase,
        runId,
        rows: quotes,
      })
    }

    const trailingTransactions = await readTrailingTransactions({
      supabase,
      targetDate,
      days: 730,
    })

    const rollups = buildDefenseMoneyRollups(trailingTransactions)

    await upsertDefenseMoneyRollups(supabase, {
      runId,
      rollups: [...rollups.weekly, ...rollups.monthly],
    })

    const activeMacro = resolveActiveMacroContext(macroEntries, targetDate)

    const cards = await buildCards({
      targetDate,
      transactions: classifiedTransactions,
      quotes,
      rollups,
      macro: activeMacro,
      llmEnabled: options.includeLlm ?? config.llmEnabled,
      llmModel: config.llmModel,
    })

    const processedBriefs = await upsertCards({
      supabase,
      runId,
      cards,
    })

    const status: DefenseMoneyRunStatus['status'] = warnings.length > 0 ? 'partial_failed' : 'succeeded'

    await completeDefenseMoneyRun({
      supabase,
      runId,
      status,
      processedTransactions,
      processedTickers: quotes.length,
      processedBriefs,
      warnings,
    })

    return {
      runId,
      status,
      processedTransactions,
      processedTickers: quotes.length,
      processedBriefs,
      warnings,
      error: null,
      targetDate,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown money signals sync failure.'

    if (runId) {
      await completeDefenseMoneyRun({
        supabase,
        runId,
        status: 'failed',
        processedTransactions: 0,
        processedTickers: 0,
        processedBriefs: 0,
        warnings,
        error: message,
      })
    }

    return {
      runId,
      status: 'failed',
      processedTransactions: 0,
      processedTickers: 0,
      processedBriefs: 0,
      warnings,
      error: message,
      targetDate,
    }
  }
}

export async function syncDefenseMoneyMacroContextFromFile() {
  const config = getDefenseMoneySignalsConfig()
  const supabase = createSupabaseAdminClientFromEnv()
  const entries = await loadMacroContextFromYaml(config.macroSnapshotPath)
  const count = await upsertMacroContextEntries(supabase, entries)

  return {
    count,
    path: config.macroSnapshotPath,
  }
}

export async function backfillDefenseMoneyMarketSignals(options?: {
  fromDate?: string
  toDate?: string
  days?: number
}) {
  const config = getDefenseMoneySignalsConfig()
  const supabase = createSupabaseAdminClientFromEnv()

  const toDate = compact(options?.toDate) || new Date().toISOString().slice(0, 10)
  const fromDate = compact(options?.fromDate) || shiftIsoDate(toDate, -(options?.days ?? config.marketBackfillDays))

  const warnings: string[] = []
  let storedRows = 0

  for (const ticker of config.marketTickers) {
    try {
      const candles = await fetchFinnhubHistoricalCandles({
        ticker,
        apiKey: config.finnhubApiKey,
        fromDate,
        toDate,
      })

      storedRows += await upsertQuotes({
        supabase,
        runId: null,
        rows: candles,
      })
    } catch (error) {
      warnings.push(`${ticker}: ${error instanceof Error ? error.message : 'unknown market backfill failure'}`)
    }
  }

  return {
    fromDate,
    toDate,
    storedRows,
    warnings,
  }
}

export async function rebuildDefenseMoneyRollups(targetDate = priorBusinessDayEt()) {
  const supabase = createSupabaseAdminClientFromEnv()

  const transactions = await readTrailingTransactions({
    supabase,
    targetDate,
    days: 730,
  })

  const rollups = buildDefenseMoneyRollups(transactions)
  const count = await upsertDefenseMoneyRollups(supabase, {
    runId: null,
    rollups: [...rollups.weekly, ...rollups.monthly],
  })

  return {
    count,
    weeklyCount: rollups.weekly.length,
    monthlyCount: rollups.monthly.length,
  }
}

export type DefenseGovSyncResult = {
  status: 'succeeded' | 'partial_failed' | 'failed'
  contractCount: number
  warnings: string[]
  error: string | null
}

export async function syncDefenseGovContracts(): Promise<DefenseGovSyncResult> {
  const config = getDefenseMoneySignalsConfig()

  if (!config.defenseGovEnabled) {
    return {status: 'succeeded', contractCount: 0, warnings: ['Defense.gov sync disabled.'], error: null}
  }

  try {
    const {contracts, warnings} = await fetchDefenseGovDailyContracts({
      rssUrl: config.defenseGovRssUrl,
      lookbackDays: config.defenseGovLookbackDays,
    })

    if (contracts.length === 0) {
      return {status: warnings.length > 0 ? 'partial_failed' : 'succeeded', contractCount: 0, warnings, error: null}
    }

    const supabase = createSupabaseAdminClientFromEnv()

    const payload = contracts.map((contract) => ({
      announcement_date: contract.announcementDate,
      contract_number: contract.contractNumber,
      contractor_name: contract.contractorName,
      awarding_agency: contract.awardingAgency,
      award_amount: contract.awardAmount,
      location: contract.location,
      description: contract.description,
      bucket_primary: contract.bucketPrimary,
      bucket_tags: contract.bucketTags,
      source_url: contract.sourceUrl,
      raw_html: contract.rawHtml,
    }))

    const {error} = await supabase.from('defense_dot_gov_daily_contracts').upsert(payload, {
      onConflict: 'announcement_date,contract_number,contractor_name',
    })

    if (error) {
      warnings.push(`Defense.gov upsert failed: ${error.message}`)
      return {status: 'partial_failed', contractCount: 0, warnings, error: error.message}
    }

    return {
      status: warnings.length > 0 ? 'partial_failed' : 'succeeded',
      contractCount: contracts.length,
      warnings,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Defense.gov sync failure.'
    return {status: 'failed', contractCount: 0, warnings: [], error: message}
  }
}

export type SamGovSyncResult = {
  status: 'succeeded' | 'partial_failed' | 'failed'
  opportunityCount: number
  warnings: string[]
  error: string | null
}

export async function syncSamGovOpportunities(): Promise<SamGovSyncResult> {
  const config = getDefenseMoneySignalsConfig()

  if (!config.samGovEnabled || !config.samGovApiKey) {
    return {
      status: 'succeeded',
      opportunityCount: 0,
      warnings: [config.samGovApiKey ? 'SAM.gov sync disabled.' : 'SAM_GOV_API_KEY missing; SAM.gov sync skipped.'],
      error: null,
    }
  }

  try {
    const postedTo = new Date().toISOString().slice(0, 10)
    const postedFromDate = new Date()
    postedFromDate.setDate(postedFromDate.getDate() - Math.min(config.samGovLookbackDays, 7))
    const postedFrom = postedFromDate.toISOString().slice(0, 10)

    const formatSamDate = (iso: string) => {
      const [year, month, day] = iso.split('-')
      return `${month}/${day}/${year}`
    }

    const {opportunities, warnings} = await fetchAllSamGovOpportunities({
      apiKey: config.samGovApiKey,
      postedFrom: formatSamDate(postedFrom),
      postedTo: formatSamDate(postedTo),
      departments: ['DEPT OF DEFENSE'],
      maxPages: 10,
    })

    if (opportunities.length === 0) {
      return {
        status: warnings.length > 0 ? 'partial_failed' : 'succeeded',
        opportunityCount: 0,
        warnings,
        error: null,
      }
    }

    const supabase = createSupabaseAdminClientFromEnv()

    const payload = opportunities.map((opp) => ({
      opportunity_id: opp.opportunityId,
      notice_type: opp.noticeType,
      title: opp.title,
      solicitation_number: opp.solicitationNumber,
      department: opp.department,
      sub_tier: opp.subTier,
      office: opp.office,
      posted_date: opp.postedDate,
      response_deadline: opp.responseDeadline,
      archive_date: opp.archiveDate,
      naics_code: opp.naicsCode,
      classification_code: opp.classificationCode,
      set_aside: opp.setAside,
      description: opp.description,
      estimated_value_low: opp.estimatedValueLow,
      estimated_value_high: opp.estimatedValueHigh,
      bucket_primary: opp.bucketPrimary,
      bucket_tags: opp.bucketTags,
      source_url: opp.sourceUrl,
      raw_payload: opp.rawPayload,
    }))

    for (let i = 0; i < payload.length; i += 200) {
      const batch = payload.slice(i, i + 200)
      const {error} = await supabase.from('sam_gov_opportunities').upsert(batch, {
        onConflict: 'opportunity_id',
      })

      if (error) {
        warnings.push(`SAM.gov upsert failed at batch ${i}: ${error.message}`)
      }
    }

    return {
      status: warnings.length > 0 ? 'partial_failed' : 'succeeded',
      opportunityCount: opportunities.length,
      warnings,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SAM.gov sync failure.'
    return {status: 'failed', opportunityCount: 0, warnings: [], error: message}
  }
}

export type BackfillUsaspendingResult = {
  totalTransactions: number
  chunks: number
  warnings: string[]
}

export async function backfillUsaspendingTransactions(options: {
  startDate: string
  endDate: string
  chunkDays?: number
  maxPagesPerChunk?: number
  onChunk?: (chunk: {startDate: string; endDate: string; transactions: number; elapsed: number; error: string | null}) => void
}): Promise<BackfillUsaspendingResult> {
  const config = getDefenseMoneySignalsConfig()
  const supabase = createSupabaseAdminClientFromEnv()
  const chunkDays = options.chunkDays ?? 30
  const maxPagesPerChunk = options.maxPagesPerChunk ?? 200
  const warnings: string[] = []

  let totalTransactions = 0
  let chunks = 0
  let chunkStart = options.startDate

  while (chunkStart <= options.endDate) {
    const chunkEnd = shiftIsoDate(chunkStart, chunkDays - 1) > options.endDate
      ? options.endDate
      : shiftIsoDate(chunkStart, chunkDays - 1)

    const t0 = Date.now()

    try {
      const {transactions: fetched, warnings: fetchWarnings} = await fetchUsaspendingTransactions({
        apiBaseUrl: config.usaspendingApiBaseUrl,
        actionDate: chunkStart,
        startDate: chunkStart,
        endDate: chunkEnd,
        awardingAgencies: config.allowedAwardingAgencies,
        minTransactionUsd: config.minTransactionUsd,
        maxPages: maxPagesPerChunk,
      })

      warnings.push(...fetchWarnings)

      const classified = classifyTransactions(fetched)

      if (classified.length > 0) {
        for (let i = 0; i < classified.length; i += 500) {
          const batch = classified.slice(i, i + 500)
          await upsertTransactions({supabase, runId: null, rows: batch})
        }
      }

      totalTransactions += classified.length
      chunks += 1

      options.onChunk?.({
        startDate: chunkStart,
        endDate: chunkEnd,
        transactions: classified.length,
        elapsed: Date.now() - t0,
        error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      warnings.push(`${chunkStart}..${chunkEnd}: ${message}`)

      options.onChunk?.({
        startDate: chunkStart,
        endDate: chunkEnd,
        transactions: 0,
        elapsed: Date.now() - t0,
        error: message,
      })
    }

    chunkStart = shiftIsoDate(chunkEnd, 1)
  }

  return {totalTransactions, chunks, warnings}
}
