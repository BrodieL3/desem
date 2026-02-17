import {createOptionalSupabaseServerClient} from '@/lib/supabase/server'

import {getDefenseMoneySignalsConfig, isDefenseMoneySignalsEnabled} from './config'
import {defenseMoneyBucketColorMap, formatDefenseMoneyBucketLabel} from './chart-colors'
import {buildDeterministicChartSummary, resolveActionLensFromBucket, resolveActionLensFromMomentum} from './chart-summaries'
import {currentEtDate, isStaleDate, isoFromDate, priorBusinessDayEt, shiftIsoDate} from './time'
import {defenseMoneyBucketValues, type DefenseMoneyActionLens, type DefenseMoneyAwardTransaction, type DefenseMoneyBucket, type DefenseMoneyChartData, type DefenseMoneyCitation, type DefenseMoneyConcentrationPoint, type DefenseMoneyDemandMomentumPoint, type DefenseMoneyMacroContext, type DefenseMoneyMarketQuote, type DefenseMoneyPrimeSparkline, type DefenseMoneyRecipientLeaderboardItem, type DefenseMoneyRollup, type DefenseMoneySparklinePoint, type DefenseMoneyWeeklyCategorySharePoint} from './types'

type AwardRow = {
  action_date: string
  transaction_amount: number | string
  recipient_name: string
  award_id: string
  source_url: string
  bucket_primary: DefenseMoneyBucket
}

type RollupRow = {
  period_start: string
  period_end: string
  total_obligations: number | string
  award_count: number
  top5_concentration: number | string | null
  category_share: unknown
  top_recipients: unknown
}

type MarketQuoteRow = {
  ticker: string
  trade_date: string
  price: number | string | null
  change_percent: number | string | null
  source_url: string | null
  context_url: string | null
  context_headline: string | null
}

type MacroRow = {
  effective_week_start: string
  headline: string
  summary: string
  so_what: string
  source_label: string
  source_url: string
  tags: string[] | null
  is_active: boolean
}

type DateRow = {
  action_date?: string
  period_start?: string
  trade_date?: string
}

type NormalizedAward = Pick<
  DefenseMoneyAwardTransaction,
  'actionDate' | 'transactionAmount' | 'recipientName' | 'awardId' | 'sourceUrl' | 'bucketPrimary'
>

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function asArrayOfObjects(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry) => entry && typeof entry === 'object') as Array<Record<string, unknown>>
}

function labelCurrency(value: number) {
  return `$${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`
}

function labelPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function labelDeltaPp(value: number) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}pp`
}

function labelDeltaPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function latestIsoDate(values: Array<string | null | undefined>) {
  const candidates = values.filter((value): value is string => Boolean(value && isIsoDate(value)))

  if (candidates.length === 0) {
    return null
  }

  return candidates.sort((left, right) => left.localeCompare(right))[candidates.length - 1] ?? null
}

function parseIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isWeekday(date: Date) {
  const day = date.getUTCDay()
  return day !== 0 && day !== 6
}

function businessDaysBetween(fromDate: string, toDate: string) {
  const start = parseIsoDate(fromDate)
  const end = parseIsoDate(toDate)

  if (!start || !end || end.getTime() <= start.getTime()) {
    return 0
  }

  const cursor = new Date(start)
  let businessDays = 0

  while (cursor.getTime() < end.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)

    if (isWeekday(cursor)) {
      businessDays += 1
    }
  }

  return businessDays
}

function isStaleByBusinessDays(dateValue: string | null, thresholdBusinessDays: number) {
  if (!dateValue) {
    return true
  }

  const todayEt = isoFromDate(currentEtDate())
  return businessDaysBetween(dateValue, todayEt) > thresholdBusinessDays
}

function listBusinessDates(targetDate: string, count: number) {
  const target = parseIsoDate(targetDate)

  if (!target) {
    return []
  }

  const cursor = new Date(target)
  const dates: string[] = []

  while (dates.length < count) {
    if (isWeekday(cursor)) {
      dates.push(cursor.toISOString().slice(0, 10))
    }

    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  return dates.reverse()
}

function normalizeCategoryShare(value: unknown): Record<DefenseMoneyBucket, number> {
  const record = asRecord(value)

  return defenseMoneyBucketValues.reduce(
    (acc, bucket) => {
      acc[bucket] = toNumber(record[bucket] as number | string | null | undefined)
      return acc
    },
    {
      ai_ml: 0,
      c5isr: 0,
      space: 0,
      autonomy: 0,
      cyber: 0,
      munitions: 0,
      ew: 0,
      counter_uas: 0,
    } as Record<DefenseMoneyBucket, number>
  )
}

function normalizeTopRecipients(value: unknown): DefenseMoneyRollup['topRecipients'] {
  return asArrayOfObjects(value).map((entry) => ({
    recipientName: compact(String(entry.recipientName ?? entry.recipient_name ?? '')),
    amount: toNumber(entry.amount as number | string | null | undefined),
    share: toNumber(entry.share as number | string | null | undefined),
  }))
}

function normalizeAwards(rows: AwardRow[]): NormalizedAward[] {
  return rows
    .map((row) => ({
      actionDate: compact(row.action_date),
      transactionAmount: toNumber(row.transaction_amount),
      recipientName: compact(row.recipient_name),
      awardId: compact(row.award_id),
      sourceUrl: compact(row.source_url),
      bucketPrimary: row.bucket_primary,
    }))
    .filter((row) => row.actionDate && row.recipientName && row.sourceUrl && defenseMoneyBucketValues.includes(row.bucketPrimary))
}

function normalizeRollups(rows: RollupRow[], periodType: DefenseMoneyRollup['periodType']): DefenseMoneyRollup[] {
  return rows
    .map((row) => ({
      periodType,
      periodStart: compact(row.period_start),
      periodEnd: compact(row.period_end),
      totalObligations: toNumber(row.total_obligations),
      awardCount: Number(row.award_count || 0),
      top5Concentration: toNumber(row.top5_concentration),
      categoryShare: normalizeCategoryShare(row.category_share),
      topRecipients: normalizeTopRecipients(row.top_recipients),
      payload: {},
    }))
    .filter((row) => row.periodStart && row.periodEnd)
}

function normalizeMarket(rows: MarketQuoteRow[]): DefenseMoneyMarketQuote[] {
  return rows
    .map((row) => ({
      ticker: compact(row.ticker).toUpperCase(),
      tradeDate: compact(row.trade_date),
      price: row.price === null ? null : toNumber(row.price),
      changeNum: null,
      changePercent: row.change_percent === null ? null : toNumber(row.change_percent),
      high: null,
      low: null,
      open: null,
      previousClose: null,
      sourceUrl: compact(row.source_url) || null,
      contextHeadline: compact(row.context_headline) || null,
      contextUrl: compact(row.context_url) || null,
    }))
    .filter((row) => row.ticker && row.tradeDate)
}

function normalizeMacro(row: MacroRow | null): DefenseMoneyMacroContext | null {
  if (!row) {
    return null
  }

  return {
    effectiveWeekStart: compact(row.effective_week_start),
    headline: compact(row.headline),
    summary: compact(row.summary),
    soWhat: compact(row.so_what),
    sourceLabel: compact(row.source_label),
    sourceUrl: compact(row.source_url),
    tags: (row.tags ?? []).map((tag) => compact(tag)).filter(Boolean),
    isActive: Boolean(row.is_active),
  }
}

function awardCitation(award: NormalizedAward): DefenseMoneyCitation {
  const slug = `${award.awardId}-${award.actionDate}-${award.recipientName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)

  return {
    id: `award-${slug}`,
    label: `${award.recipientName} · ${labelCurrency(award.transactionAmount)} · ${award.actionDate}`,
    url: award.sourceUrl,
    sourceLabel: 'USAspending',
  }
}

function marketCitation(quote: DefenseMoneyMarketQuote): DefenseMoneyCitation | null {
  const url = quote.contextUrl || quote.sourceUrl

  if (!url) {
    return null
  }

  return {
    id: `quote-${quote.ticker}-${quote.tradeDate}`,
    label: quote.contextHeadline ? `${quote.ticker} · ${quote.contextHeadline}` : `${quote.ticker} · Quote`,
    url,
    sourceLabel: quote.contextUrl ? 'Finnhub Company News' : 'Finnhub Quote',
  }
}

function dedupeCitations(citations: DefenseMoneyCitation[]) {
  const seen = new Set<string>()
  const deduped: DefenseMoneyCitation[] = []

  for (const citation of citations) {
    if (!citation.id || !citation.url || seen.has(citation.id)) {
      continue
    }

    seen.add(citation.id)
    deduped.push(citation)
  }

  return deduped
}

function topAwards(rows: NormalizedAward[], limit: number) {
  return [...rows].sort((left, right) => right.transactionAmount - left.transactionAmount).slice(0, limit)
}

function dateInRange(value: string, start: string, end: string) {
  return value >= start && value <= end
}

function emptyChartData(targetDate: string): DefenseMoneyChartData {
  return {
    generatedAt: new Date().toISOString(),
    targetDate,
    demandMomentum: {
      points: [],
      fiveDayDelta: null,
      summary: buildDeterministicChartSummary({
        headline: 'Demand momentum',
        actionLens: 'partner',
        soWhat: 'No obligations data is available yet for trend inference.',
        claims: [],
        citations: [],
      }),
      insufficientData: true,
    },
    weeklyCategoryShare: {
      points: [],
      summary: buildDeterministicChartSummary({
        headline: 'Weekly category share',
        actionLens: 'partner',
        soWhat: 'No weekly rollups are available yet.',
        claims: [],
        citations: [],
      }),
      insufficientData: true,
    },
    concentrationTrend: {
      weekly: [],
      monthly: [],
      weeklyDelta: null,
      monthlyDelta: null,
      summary: buildDeterministicChartSummary({
        headline: 'Concentration trend',
        actionLens: 'partner',
        soWhat: 'Recipient concentration cannot be evaluated without rollups.',
        claims: [],
        citations: [],
      }),
      insufficientData: true,
    },
    recipientLeaderboard: {
      items: [],
      summary: buildDeterministicChartSummary({
        headline: 'Recipient leaderboard',
        actionLens: 'partner',
        soWhat: 'No 30-day recipient leaderboard is available yet.',
        claims: [],
        citations: [],
      }),
      insufficientData: true,
    },
    primeSparklines: {
      tickers: [],
      summary: buildDeterministicChartSummary({
        headline: 'Prime sparklines',
        actionLens: 'partner',
        soWhat: 'No market quote history is available yet.',
        claims: [],
        citations: [],
      }),
      insufficientData: true,
    },
    macroContext: null,
    thisWeekSignal: null,
    staleData: {
      awards: true,
      rollups: true,
      market: true,
      macro: true,
    },
  }
}

function ensureBucketRecord() {
  return defenseMoneyBucketValues.reduce(
    (acc, bucket) => {
      acc[bucket] = 0
      return acc
    },
    {
      ai_ml: 0,
      c5isr: 0,
      space: 0,
      autonomy: 0,
      cyber: 0,
      munitions: 0,
      ew: 0,
      counter_uas: 0,
    } as Record<DefenseMoneyBucket, number>
  )
}

function soWhatForActionLens(actionLens: DefenseMoneyActionLens) {
  if (actionLens === 'build') {
    return 'Shift roadmap and technical investment toward categories with accelerating funded demand.'
  }

  if (actionLens === 'sell') {
    return 'Prioritize near-term capture and partner channels where obligations are concentrating quickly.'
  }

  return 'Treat signals as mixed: prioritize partner alignment and selective pursuits over broad expansion.'
}

function mapDemandMomentum(input: {
  targetDate: string
  awards: NormalizedAward[]
}) {
  const businessDates = listBusinessDates(input.targetDate, 20)
  const awardsByDate = new Map<string, NormalizedAward[]>()

  for (const award of input.awards) {
    const rows = awardsByDate.get(award.actionDate) ?? []
    rows.push(award)
    awardsByDate.set(award.actionDate, rows)
  }

  const points: DefenseMoneyDemandMomentumPoint[] = businessDates.map((date) => {
    const rows = awardsByDate.get(date) ?? []
    const totalObligations = rows.reduce((sum, row) => sum + row.transactionAmount, 0)
    const largestAwardAmount = rows.reduce((largest, row) => Math.max(largest, row.transactionAmount), 0)

    return {
      date,
      totalObligations: Number(totalObligations.toFixed(2)),
      awardCount: rows.length,
      largestAwardAmount: Number(largestAwardAmount.toFixed(2)),
    }
  })

  const currentFiveDates = businessDates.slice(-5)
  const priorFiveDates = businessDates.slice(-10, -5)
  const currentDateSet = new Set(currentFiveDates)
  const priorDateSet = new Set(priorFiveDates)

  const currentRows = input.awards.filter((award) => currentDateSet.has(award.actionDate))
  const priorRows = input.awards.filter((award) => priorDateSet.has(award.actionDate))

  const currentAverage =
    currentFiveDates.length > 0
      ? currentFiveDates.reduce((sum, date) => sum + (awardsByDate.get(date) ?? []).reduce((inner, row) => inner + row.transactionAmount, 0), 0) /
        currentFiveDates.length
      : 0
  const priorAverage =
    priorFiveDates.length > 0
      ? priorFiveDates.reduce((sum, date) => sum + (awardsByDate.get(date) ?? []).reduce((inner, row) => inner + row.transactionAmount, 0), 0) /
        priorFiveDates.length
      : 0

  const fiveDayDelta = priorAverage > 0 ? (currentAverage - priorAverage) / priorAverage : null

  const currentBucketTotals = ensureBucketRecord()
  const priorBucketTotals = ensureBucketRecord()

  for (const award of currentRows) {
    currentBucketTotals[award.bucketPrimary] += award.transactionAmount
  }

  for (const award of priorRows) {
    priorBucketTotals[award.bucketPrimary] += award.transactionAmount
  }

  const currentTotal = Object.values(currentBucketTotals).reduce((sum, value) => sum + value, 0)
  const priorTotal = Object.values(priorBucketTotals).reduce((sum, value) => sum + value, 0)
  const bucketMomentum = ensureBucketRecord()

  for (const bucket of defenseMoneyBucketValues) {
    const currentShare = currentTotal > 0 ? currentBucketTotals[bucket] / currentTotal : 0
    const priorShare = priorTotal > 0 ? priorBucketTotals[bucket] / priorTotal : 0
    bucketMomentum[bucket] = Number((currentShare - priorShare).toFixed(6))
  }

  const latestDate = businessDates[businessDates.length - 1] ?? null
  const latestRows = latestDate ? awardsByDate.get(latestDate) ?? [] : []

  const citations = dedupeCitations(
    [...topAwards(latestRows, 2), ...topAwards(currentRows, 4)].map((award) => awardCitation(award))
  )

  const actionLens = resolveActionLensFromMomentum(bucketMomentum)
  const firstClaimCitationIds = dedupeCitations(topAwards(latestRows, 2).map((award) => awardCitation(award))).map((entry) => entry.id)
  const secondClaimCitationIds = dedupeCitations(topAwards(currentRows, 3).map((award) => awardCitation(award))).map((entry) => entry.id)
  const latestPoint = latestDate ? points.find((point) => point.date === latestDate) ?? null : null

  const claims = [
    latestPoint
      ? {
          id: 'latest-day',
          text: `${latestDate}: ${labelCurrency(latestPoint.totalObligations)} across ${latestPoint.awardCount} obligations.`,
          citationIds: firstClaimCitationIds,
        }
      : null,
    fiveDayDelta !== null
      ? {
          id: 'five-day-delta',
          text: `Five-day average obligations are ${labelDeltaPercent(fiveDayDelta)} versus the prior five business days.`,
          citationIds: secondClaimCitationIds,
        }
      : null,
  ].filter((claim): claim is {id: string; text: string; citationIds: string[]} => claim !== null)

  const summary = buildDeterministicChartSummary({
    headline: 'Demand momentum',
    actionLens,
    soWhat: soWhatForActionLens(actionLens),
    claims,
    citations,
  })

  return {
    points,
    fiveDayDelta,
    bucketMomentum,
    summary,
    insufficientData: points.filter((point) => point.totalObligations > 0).length < 2,
  }
}

function mapWeeklyCategoryShare(input: {
  weeklyRollups: DefenseMoneyRollup[]
  awards: NormalizedAward[]
}) {
  const weeklyDesc = [...input.weeklyRollups].sort((left, right) => right.periodStart.localeCompare(left.periodStart)).slice(0, 12)
  const points: DefenseMoneyWeeklyCategorySharePoint[] = [...weeklyDesc]
    .reverse()
    .map((rollup) => ({
      periodStart: rollup.periodStart,
      periodEnd: rollup.periodEnd,
      totalObligations: rollup.totalObligations,
      categoryShare: rollup.categoryShare,
    }))

  const latest = weeklyDesc[0] ?? null
  const prior = weeklyDesc[1] ?? null
  const citations = latest
    ? dedupeCitations(
        topAwards(
          input.awards.filter((award) => dateInRange(award.actionDate, latest.periodStart, latest.periodEnd)),
          4
        ).map((award) => awardCitation(award))
      )
    : []

  const bucketMomentum = ensureBucketRecord()

  if (latest && prior) {
    for (const bucket of defenseMoneyBucketValues) {
      bucketMomentum[bucket] = Number((latest.categoryShare[bucket] - prior.categoryShare[bucket]).toFixed(6))
    }
  }

  const topBucketEntry = defenseMoneyBucketValues
    .map((bucket) => ({
      bucket,
      value: bucketMomentum[bucket],
    }))
    .sort((left, right) => right.value - left.value)[0]

  const actionLens = resolveActionLensFromMomentum(bucketMomentum)
  const claimCitationIds = citations.slice(0, 2).map((citation) => citation.id)

  const claims = [
    latest && topBucketEntry
      ? {
          id: 'latest-share',
          text: `${formatDefenseMoneyBucketLabel(topBucketEntry.bucket)} held ${labelPercent(latest.categoryShare[topBucketEntry.bucket])} of weekly obligations.`,
          citationIds: claimCitationIds,
        }
      : null,
    latest && prior && topBucketEntry
      ? {
          id: 'share-delta',
          text: `${formatDefenseMoneyBucketLabel(topBucketEntry.bucket)} shifted ${labelDeltaPp(topBucketEntry.value)} week over week.`,
          citationIds: claimCitationIds,
        }
      : null,
  ].filter((claim): claim is {id: string; text: string; citationIds: string[]} => claim !== null)

  const summary = buildDeterministicChartSummary({
    headline: 'Weekly category share',
    actionLens,
    soWhat: soWhatForActionLens(actionLens),
    claims,
    citations,
  })

  return {
    points,
    summary,
    insufficientData: points.length < 2,
    bucketMomentum,
    latest,
    prior,
  }
}

function mapConcentrationTrend(input: {
  weeklyRollups: DefenseMoneyRollup[]
  monthlyRollups: DefenseMoneyRollup[]
  awards: NormalizedAward[]
}) {
  const weeklyDesc = [...input.weeklyRollups].sort((left, right) => right.periodStart.localeCompare(left.periodStart)).slice(0, 12)
  const monthlyDesc = [...input.monthlyRollups].sort((left, right) => right.periodStart.localeCompare(left.periodStart)).slice(0, 12)

  const weekly: DefenseMoneyConcentrationPoint[] = [...weeklyDesc]
    .reverse()
    .map((rollup) => ({
      periodStart: rollup.periodStart,
      periodEnd: rollup.periodEnd,
      totalObligations: rollup.totalObligations,
      top5Concentration: rollup.top5Concentration,
    }))
  const monthly: DefenseMoneyConcentrationPoint[] = [...monthlyDesc]
    .reverse()
    .map((rollup) => ({
      periodStart: rollup.periodStart,
      periodEnd: rollup.periodEnd,
      totalObligations: rollup.totalObligations,
      top5Concentration: rollup.top5Concentration,
    }))

  const weeklyDelta =
    weeklyDesc.length >= 2 ? Number((weeklyDesc[0].top5Concentration - weeklyDesc[1].top5Concentration).toFixed(6)) : null
  const monthlyDelta =
    monthlyDesc.length >= 2 ? Number((monthlyDesc[0].top5Concentration - monthlyDesc[1].top5Concentration).toFixed(6)) : null

  const latestWeek = weeklyDesc[0] ?? null
  const citations = latestWeek
    ? dedupeCitations(
        topAwards(
          input.awards.filter((award) => dateInRange(award.actionDate, latestWeek.periodStart, latestWeek.periodEnd)),
          4
        ).map((award) => awardCitation(award))
      )
    : []

  const actionLens: DefenseMoneyActionLens = weeklyDelta !== null && weeklyDelta > 0 ? 'sell' : 'partner'
  const claimCitationIds = citations.slice(0, 2).map((citation) => citation.id)

  const claims = [
    latestWeek
      ? {
          id: 'latest-weekly-concentration',
          text: `Weekly top-5 concentration is ${labelPercent(latestWeek.top5Concentration)}.`,
          citationIds: claimCitationIds,
        }
      : null,
    weeklyDelta !== null
      ? {
          id: 'weekly-concentration-delta',
          text: `Weekly concentration moved ${labelDeltaPp(weeklyDelta)} versus the prior week.`,
          citationIds: claimCitationIds,
        }
      : null,
    monthlyDelta !== null
      ? {
          id: 'monthly-concentration-delta',
          text: `Monthly concentration moved ${labelDeltaPp(monthlyDelta)} versus the prior month.`,
          citationIds: claimCitationIds,
        }
      : null,
  ].filter((claim): claim is {id: string; text: string; citationIds: string[]} => claim !== null)

  const summary = buildDeterministicChartSummary({
    headline: 'Concentration trend',
    actionLens,
    soWhat:
      weeklyDelta !== null && weeklyDelta > 0
        ? 'Capture lanes are tightening; prioritize near-term bids where entry barriers remain low.'
        : 'Concentration is stable-to-easing; pursue selective displacement where incumbents are less entrenched.',
    claims,
    citations,
  })

  return {
    weekly,
    monthly,
    weeklyDelta,
    monthlyDelta,
    summary,
    insufficientData: weekly.length < 2 && monthly.length < 2,
  }
}

function mapRecipientLeaderboard(input: {targetDate: string; awards: NormalizedAward[]}) {
  const leaderboardStart = shiftIsoDate(input.targetDate, -30)
  const rows = input.awards.filter((award) => award.actionDate >= leaderboardStart && award.actionDate <= input.targetDate)

  const totalsByRecipient = new Map<
    string,
    {
      totalObligations: number
      awardCount: number
      rows: NormalizedAward[]
    }
  >()

  for (const award of rows) {
    const current = totalsByRecipient.get(award.recipientName) ?? {
      totalObligations: 0,
      awardCount: 0,
      rows: [],
    }
    current.totalObligations += award.transactionAmount
    current.awardCount += 1
    current.rows.push(award)
    totalsByRecipient.set(award.recipientName, current)
  }

  const overallTotal = rows.reduce((sum, row) => sum + row.transactionAmount, 0)
  const items: DefenseMoneyRecipientLeaderboardItem[] = [...totalsByRecipient.entries()]
    .map(([recipientName, value]) => ({
      recipientName,
      totalObligations: Number(value.totalObligations.toFixed(2)),
      share: overallTotal > 0 ? Number((value.totalObligations / overallTotal).toFixed(6)) : 0,
      awardCount: value.awardCount,
    }))
    .sort((left, right) => right.totalObligations - left.totalObligations)
    .slice(0, 10)

  const citations = dedupeCitations(
    items
      .slice(0, 5)
      .flatMap((item) => totalsByRecipient.get(item.recipientName)?.rows ?? [])
      .sort((left, right) => right.transactionAmount - left.transactionAmount)
      .slice(0, 5)
      .map((award) => awardCitation(award))
  )

  const bucketTotals = ensureBucketRecord()

  for (const row of rows) {
    bucketTotals[row.bucketPrimary] += row.transactionAmount
  }

  const totalBucketAmount = Object.values(bucketTotals).reduce((sum, value) => sum + value, 0)
  const bucketMomentum = ensureBucketRecord()

  for (const bucket of defenseMoneyBucketValues) {
    bucketMomentum[bucket] = totalBucketAmount > 0 ? bucketTotals[bucket] / totalBucketAmount : 0
  }

  const actionLens = resolveActionLensFromMomentum(bucketMomentum)
  const topRecipient = items[0]
  const topThreeShare = items.slice(0, 3).reduce((sum, item) => sum + item.share, 0)
  const topCitationIds = citations.slice(0, 2).map((citation) => citation.id)

  const summary = buildDeterministicChartSummary({
    headline: 'Recipient leaderboard',
    actionLens,
    soWhat: soWhatForActionLens(actionLens),
    claims: [
      topRecipient
        ? {
            id: 'top-recipient-share',
            text: `${topRecipient.recipientName} leads with ${labelPercent(topRecipient.share)} of 30-day obligations.`,
            citationIds: topCitationIds,
          }
        : {
            id: 'empty-leaderboard',
            text: '',
            citationIds: [],
          },
      topRecipient
        ? {
            id: 'top-three-share',
            text: `Top 3 recipients account for ${labelPercent(topThreeShare)} of 30-day obligations.`,
            citationIds: topCitationIds,
          }
        : {
            id: 'empty-leaderboard-2',
            text: '',
            citationIds: [],
          },
    ],
    citations,
  })

  return {
    items,
    summary,
    insufficientData: items.length < 2,
  }
}

function computeLatestChangePercent(quotes: DefenseMoneyMarketQuote[]) {
  const sorted = [...quotes].sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
  const latest = sorted[sorted.length - 1] ?? null

  if (!latest) {
    return null
  }

  if (latest.changePercent !== null) {
    return Number(latest.changePercent.toFixed(4))
  }

  const priced = sorted.filter((entry) => typeof entry.price === 'number').map((entry) => Number(entry.price))

  if (priced.length < 2) {
    return null
  }

  const current = priced[priced.length - 1] ?? null
  const previous = priced[priced.length - 2] ?? null

  if (current === null || previous === null || previous === 0) {
    return null
  }

  return Number((((current - previous) / previous) * 100).toFixed(4))
}

function mapPrimeSparklines(input: {
  marketQuotes: DefenseMoneyMarketQuote[]
  tickers: string[]
  targetDate: string
}) {
  const marketStart = shiftIsoDate(input.targetDate, -31)
  const quotesInWindow = input.marketQuotes.filter(
    (quote) => quote.tradeDate >= marketStart && quote.tradeDate <= input.targetDate
  )

  const rowsByTicker = new Map<string, DefenseMoneyMarketQuote[]>()

  for (const quote of quotesInWindow) {
    const rows = rowsByTicker.get(quote.ticker) ?? []
    rows.push(quote)
    rowsByTicker.set(quote.ticker, rows)
  }

  const tickers: DefenseMoneyPrimeSparkline[] = input.tickers.map((ticker) => {
    const rows = [...(rowsByTicker.get(ticker) ?? [])].sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
    const points: DefenseMoneySparklinePoint[] = rows
      .filter((row) => typeof row.price === 'number')
      .map((row) => ({
        tradeDate: row.tradeDate,
        price: Number(row.price ?? 0),
      }))

    const latestQuote = rows[rows.length - 1] ?? null
    const citation = latestQuote ? marketCitation(latestQuote) : null
    const latestChangePercent = computeLatestChangePercent(rows)

    return {
      ticker,
      coverage: points.length >= 2 ? 'full' : 'partial',
      latestChangePercent,
      points,
      citation,
    }
  })

  const usable = tickers.filter((ticker) => ticker.latestChangePercent !== null)
  const topMover = [...usable].sort(
    (left, right) => Math.abs(right.latestChangePercent ?? 0) - Math.abs(left.latestChangePercent ?? 0)
  )[0]

  const topMoverCitationIds = topMover?.citation ? [topMover.citation.id] : []
  const citations = dedupeCitations(tickers.map((ticker) => ticker.citation).filter((citation): citation is DefenseMoneyCitation => citation !== null))

  const summary = buildDeterministicChartSummary({
    headline: 'Prime sparklines',
    actionLens: 'partner',
    soWhat: 'Use prime market context as a positioning input, not a standalone demand signal.',
    claims: [
      topMover
        ? {
            id: 'top-mover',
            text: `${topMover.ticker} moved ${topMover.latestChangePercent?.toFixed(2)}% in the latest quote window.`,
            citationIds: topMoverCitationIds,
          }
        : {
            id: 'no-top-mover',
            text: '',
            citationIds: [],
          },
      {
        id: 'coverage',
        text: `${tickers.filter((ticker) => ticker.coverage === 'full').length}/${tickers.length} tickers have full sparkline coverage.`,
        citationIds: citations.slice(0, 2).map((citation) => citation.id),
      },
    ],
    citations,
  })

  return {
    tickers,
    summary,
    insufficientData: tickers.filter((ticker) => ticker.points.length >= 2).length < 2,
  }
}

function mapThisWeekSignal(input: {
  weeklyRollups: DefenseMoneyRollup[]
  awards: NormalizedAward[]
}): DefenseMoneyChartData['thisWeekSignal'] {
  const weeklyDesc = [...input.weeklyRollups].sort((left, right) => right.periodStart.localeCompare(left.periodStart))
  const latest = weeklyDesc[0] ?? null
  const prior = weeklyDesc[1] ?? null

  if (!latest || !prior) {
    return null
  }

  const bucketDelta = defenseMoneyBucketValues
    .map((bucket) => ({
      bucket,
      delta: Number((latest.categoryShare[bucket] - prior.categoryShare[bucket]).toFixed(6)),
    }))
    .sort((left, right) => right.delta - left.delta)[0]

  if (!bucketDelta) {
    return null
  }

  const concentrationDelta = Number((latest.top5Concentration - prior.top5Concentration).toFixed(6))
  const actionLens = resolveActionLensFromBucket(bucketDelta.bucket)
  const citations = dedupeCitations(
    topAwards(
      input.awards.filter((award) => dateInRange(award.actionDate, latest.periodStart, latest.periodEnd)),
      3
    ).map((award) => awardCitation(award))
  )

  return {
    summary: `${formatDefenseMoneyBucketLabel(bucketDelta.bucket)} share ${labelDeltaPp(bucketDelta.delta)}; top-5 concentration ${labelDeltaPp(concentrationDelta)} WoW.`,
    soWhat: soWhatForActionLens(actionLens),
    actionLens,
    citations,
    topBucket: bucketDelta.bucket,
    topBucketDelta: bucketDelta.delta,
    concentrationDelta,
  }
}

export function buildDefenseMoneyChartsDataFromRows(input: {
  targetDate: string
  awardTransactions: NormalizedAward[]
  weeklyRollups: DefenseMoneyRollup[]
  monthlyRollups: DefenseMoneyRollup[]
  marketQuotes: DefenseMoneyMarketQuote[]
  activeMacro: DefenseMoneyMacroContext | null
  marketTickers: string[]
  generatedAt?: string
  latestDates?: {
    awards?: string | null
    weeklyRollups?: string | null
    market?: string | null
    macro?: string | null
  }
}): DefenseMoneyChartData {
  const targetDate = compact(input.targetDate) || priorBusinessDayEt()
  const base = emptyChartData(targetDate)

  const demandMomentum = mapDemandMomentum({
    targetDate,
    awards: input.awardTransactions,
  })

  const weeklyCategoryShare = mapWeeklyCategoryShare({
    weeklyRollups: input.weeklyRollups,
    awards: input.awardTransactions,
  })

  const concentrationTrend = mapConcentrationTrend({
    weeklyRollups: input.weeklyRollups,
    monthlyRollups: input.monthlyRollups,
    awards: input.awardTransactions,
  })

  const recipientLeaderboard = mapRecipientLeaderboard({
    targetDate,
    awards: input.awardTransactions,
  })

  const primeSparklines = mapPrimeSparklines({
    targetDate,
    marketQuotes: input.marketQuotes,
    tickers: input.marketTickers,
  })

  const latestAwardDate = input.latestDates?.awards ?? latestIsoDate(input.awardTransactions.map((row) => row.actionDate))
  const latestWeeklyDate = input.latestDates?.weeklyRollups ?? latestIsoDate(input.weeklyRollups.map((row) => row.periodStart))
  const latestMarketDate = input.latestDates?.market ?? latestIsoDate(input.marketQuotes.map((row) => row.tradeDate))
  const latestMacroDate = input.latestDates?.macro ?? input.activeMacro?.effectiveWeekStart ?? null

  const staleData = {
    awards: isStaleByBusinessDays(latestAwardDate, 2),
    rollups: isStaleDate(latestWeeklyDate, 10),
    market: isStaleDate(latestMarketDate, 4),
    macro: !input.activeMacro || !latestMacroDate,
  }

  return {
    ...base,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    targetDate,
    demandMomentum,
    weeklyCategoryShare: {
      points: weeklyCategoryShare.points,
      summary: weeklyCategoryShare.summary,
      insufficientData: weeklyCategoryShare.insufficientData,
    },
    concentrationTrend,
    recipientLeaderboard,
    primeSparklines,
    macroContext: input.activeMacro,
    thisWeekSignal: mapThisWeekSignal({
      weeklyRollups: input.weeklyRollups,
      awards: input.awardTransactions,
    }),
    staleData,
  }
}

export {isDefenseMoneySignalsEnabled}

export type ContractVelocityPoint = {
  date: string
  usaspending: number
  defenseGov: number
}

export type ContractVelocityData = {
  points: ContractVelocityPoint[]
  gapAnnotation: string | null
}

export async function getContractVelocityData(options?: {date?: string}): Promise<ContractVelocityData> {
  const config = getDefenseMoneySignalsConfig()
  const targetDate = compact(options?.date) || priorBusinessDayEt()
  const empty: ContractVelocityData = {points: [], gapAnnotation: null}

  if (!config.enabled) {
    return empty
  }

  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return empty
  }

  const startDate = shiftIsoDate(targetDate, -45)

  // Query USAspending daily totals
  const {data: usaRows} = await supabase
    .from('defense_money_award_transactions')
    .select('action_date, transaction_amount')
    .gte('action_date', startDate)
    .lte('action_date', targetDate)
    .returns<Array<{action_date: string; transaction_amount: number | string}>>()

  // Query Defense.gov daily totals
  const {data: dgovRows} = await supabase
    .from('defense_dot_gov_daily_contracts')
    .select('announcement_date, award_amount')
    .gte('announcement_date', startDate)
    .lte('announcement_date', targetDate)
    .returns<Array<{announcement_date: string; award_amount: number | string}>>()

  const usaByDate = new Map<string, number>()

  for (const row of usaRows ?? []) {
    const date = compact(row.action_date)
    usaByDate.set(date, (usaByDate.get(date) ?? 0) + toNumber(row.transaction_amount))
  }

  const dgovByDate = new Map<string, number>()

  for (const row of dgovRows ?? []) {
    const date = compact(row.announcement_date)
    dgovByDate.set(date, (dgovByDate.get(date) ?? 0) + toNumber(row.award_amount))
  }

  const allDates = new Set([...usaByDate.keys(), ...dgovByDate.keys()])
  const sortedDates = [...allDates].sort()

  const points: ContractVelocityPoint[] = sortedDates.map((date) => ({
    date,
    usaspending: Number((usaByDate.get(date) ?? 0).toFixed(2)),
    defenseGov: Number((dgovByDate.get(date) ?? 0).toFixed(2)),
  }))

  // Detect gap
  const usaDates = [...usaByDate.keys()].sort()
  const dgovDates = [...dgovByDate.keys()].sort()
  const latestUsa = usaDates[usaDates.length - 1] ?? null
  const earliestDgov = dgovDates[0] ?? null
  const gapAnnotation =
    latestUsa && earliestDgov && latestUsa < earliestDgov
      ? `USAspending data ends ${latestUsa}. Defense.gov fills ${earliestDgov} onward.`
      : null

  return {points, gapAnnotation}
}

export type NewsMoneyHeatmapData = {
  cells: Array<{topicLabel: string; bucket: string; bucketLabel: string; count: number}>
  topicLabels: string[]
  bucketLabels: string[]
}

export async function getNewsMoneyHeatmapData(): Promise<NewsMoneyHeatmapData> {
  const empty: NewsMoneyHeatmapData = {cells: [], topicLabels: [], bucketLabels: []}

  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return empty
  }

  // Get cross-reference links with article topics and contract buckets
  const {data: linkRows} = await supabase
    .from('article_contract_links')
    .select('article_id, contract_source, contract_id')
    .limit(500)
    .returns<Array<{article_id: string; contract_source: string; contract_id: string}>>()

  if (!linkRows || linkRows.length === 0) {
    return empty
  }

  const articleIds = [...new Set(linkRows.map((row) => row.article_id))]
  const usaspendingIds = linkRows.filter((row) => row.contract_source === 'usaspending').map((row) => row.contract_id)
  const defenseGovIds = linkRows.filter((row) => row.contract_source === 'defense_gov').map((row) => row.contract_id)

  // Get topic labels for articles
  const {data: topicRows} = await supabase
    .from('article_topics')
    .select('article_id, topics(label, topic_type)')
    .in('article_id', articleIds.slice(0, 200))
    .returns<Array<{article_id: string; topics: {label: string; topic_type: string | null} | null}>>()

  const articleTopics = new Map<string, string[]>()

  for (const row of topicRows ?? []) {
    if (!row.topics || (row.topics.topic_type !== 'company' && row.topics.topic_type !== 'technology' && row.topics.topic_type !== 'program')) {
      continue
    }

    const topics = articleTopics.get(row.article_id) ?? []
    topics.push(row.topics.label)
    articleTopics.set(row.article_id, topics)
  }

  // Get bucket for contracts
  const contractBuckets = new Map<string, string>()

  if (usaspendingIds.length > 0) {
    const {data: usaRows} = await supabase
      .from('defense_money_award_transactions')
      .select('generated_internal_id, bucket_primary')
      .in('generated_internal_id', usaspendingIds.slice(0, 200))
      .returns<Array<{generated_internal_id: string; bucket_primary: string}>>()

    for (const row of usaRows ?? []) {
      contractBuckets.set(`usaspending:${row.generated_internal_id}`, row.bucket_primary)
    }
  }

  if (defenseGovIds.length > 0) {
    const {data: dgovRows} = await supabase
      .from('defense_dot_gov_daily_contracts')
      .select('id, bucket_primary')
      .in('id', defenseGovIds.slice(0, 200))
      .returns<Array<{id: string; bucket_primary: string}>>()

    for (const row of dgovRows ?? []) {
      contractBuckets.set(`defense_gov:${row.id}`, row.bucket_primary)
    }
  }

  // Build heatmap
  const countMap = new Map<string, number>()
  const allTopics = new Set<string>()
  const allBuckets = new Set<string>()

  for (const link of linkRows) {
    const topics = articleTopics.get(link.article_id)
    const bucket = contractBuckets.get(`${link.contract_source}:${link.contract_id}`)

    if (!topics || !bucket) {
      continue
    }

    const bucketLabel = formatDefenseMoneyBucketLabel(bucket as DefenseMoneyBucket)
    allBuckets.add(bucketLabel)

    for (const topic of topics) {
      allTopics.add(topic)
      const key = `${topic}:${bucketLabel}`
      countMap.set(key, (countMap.get(key) ?? 0) + 1)
    }
  }

  const topicLabels = [...allTopics].sort()
  const bucketLabels = [...allBuckets].sort()

  const cells = [...countMap.entries()].map(([key, count]) => {
    const [topicLabel, bucketLabel] = key.split(':')
    return {
      topicLabel: topicLabel ?? '',
      bucket: bucketLabel ?? '',
      bucketLabel: bucketLabel ?? '',
      count,
    }
  })

  return {cells, topicLabels, bucketLabels}
}

export type MomentumCell = {
  weekLabel: string
  periodStart: string
  bucket: DefenseMoneyBucket
  bucketLabel: string
  amount: number
  awardCount: number
  acceleration: number
  direction: 'growing' | 'declining' | 'flat'
}

export type CategoryMomentumData = {
  cells: MomentumCell[]
  weeks: string[]
  buckets: DefenseMoneyBucket[]
  insufficientData: boolean
}

function formatWeekLabel(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'})
}

export async function getCategoryMomentumData(options?: {date?: string}): Promise<CategoryMomentumData> {
  const empty: CategoryMomentumData = {cells: [], weeks: [], buckets: [...defenseMoneyBucketValues], insufficientData: true}

  const config = getDefenseMoneySignalsConfig()
  const targetDate = compact(options?.date) || priorBusinessDayEt()

  if (!config.enabled) {
    return empty
  }

  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return empty
  }

  const {data: rollupRows} = await supabase
    .from('defense_money_rollups')
    .select('period_start, period_end, total_obligations, award_count, top5_concentration, category_share, top_recipients')
    .eq('period_type', 'week')
    .lte('period_start', targetDate)
    .order('period_start', {ascending: false})
    .limit(13)
    .returns<RollupRow[]>()

  const rollups = normalizeRollups(rollupRows ?? [], 'week')
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))

  if (rollups.length < 2) {
    return empty
  }

  const cells: MomentumCell[] = []
  const weeks: string[] = []

  // We need 13 weeks to compute 12 deltas, or just show what we have
  for (let i = 1; i < rollups.length; i++) {
    const current = rollups[i]
    const prior = rollups[i - 1]
    weeks.push(formatWeekLabel(current.periodStart))

    for (const bucket of defenseMoneyBucketValues) {
      const amount = current.categoryShare[bucket] * current.totalObligations
      const priorAmount = prior.categoryShare[bucket] * prior.totalObligations
      const acceleration = priorAmount > 0 ? (amount - priorAmount) / priorAmount : 0
      const direction: MomentumCell['direction'] =
        acceleration > 0.05 ? 'growing' : acceleration < -0.05 ? 'declining' : 'flat'

      cells.push({
        weekLabel: formatWeekLabel(current.periodStart),
        periodStart: current.periodStart,
        bucket,
        bucketLabel: formatDefenseMoneyBucketLabel(bucket),
        amount,
        awardCount: current.awardCount,
        acceleration,
        direction,
      })
    }
  }

  return {
    cells,
    weeks,
    buckets: [...defenseMoneyBucketValues],
    insufficientData: weeks.length < 4,
  }
}

export type PrimeFlowNode = {
  name: string
  colorToken?: string
}

export type PrimeFlowLink = {
  source: number
  target: number
  value: number
}

export type PrimeFlowData = {
  nodes: PrimeFlowNode[]
  links: PrimeFlowLink[]
  insufficientData: boolean
}

export async function getPrimeFlowData(options?: {date?: string}): Promise<PrimeFlowData> {
  const empty: PrimeFlowData = {nodes: [], links: [], insufficientData: true}

  const config = getDefenseMoneySignalsConfig()
  const targetDate = compact(options?.date) || priorBusinessDayEt()

  if (!config.enabled) {
    return empty
  }

  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return empty
  }

  const startDate = shiftIsoDate(targetDate, -45)

  const {data: rows} = await supabase
    .from('defense_money_award_transactions')
    .select('recipient_name, bucket_primary, transaction_amount')
    .gte('action_date', startDate)
    .lte('action_date', targetDate)
    .returns<Array<{recipient_name: string; bucket_primary: DefenseMoneyBucket; transaction_amount: number | string}>>()

  const txns = (rows ?? []).filter(
    (r) => r.recipient_name?.trim() && defenseMoneyBucketValues.includes(r.bucket_primary)
  )

  // Group by recipient, take top 10
  const recipientTotals = new Map<string, number>()

  for (const txn of txns) {
    const name = txn.recipient_name.trim()
    recipientTotals.set(name, (recipientTotals.get(name) ?? 0) + toNumber(txn.transaction_amount))
  }

  const topPrimes = [...recipientTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name)

  if (topPrimes.length < 5) {
    return empty
  }

  const topPrimeSet = new Set(topPrimes)
  const filteredTxns = txns.filter((t) => topPrimeSet.has(t.recipient_name.trim()))

  // Determine active buckets and size buckets
  const activeBuckets = new Set<DefenseMoneyBucket>()
  const sizeBucketLabel = (amount: number) => {
    if (amount < 1_000_000) return '<$1M'
    if (amount < 5_000_000) return '$1M–$5M'
    if (amount < 20_000_000) return '$5M–$20M'
    return '$20M+'
  }

  // Build aggregation: prime→bucket→sizeBucket
  const primeBucket = new Map<string, Map<string, number>>()
  const bucketSize = new Map<string, Map<string, number>>()

  for (const txn of filteredTxns) {
    const name = txn.recipient_name.trim()
    const amount = toNumber(txn.transaction_amount)
    const bucket = txn.bucket_primary
    const size = sizeBucketLabel(amount)

    activeBuckets.add(bucket)

    // prime→bucket
    if (!primeBucket.has(name)) primeBucket.set(name, new Map())
    const pb = primeBucket.get(name)!
    pb.set(bucket, (pb.get(bucket) ?? 0) + amount)

    // bucket→size
    if (!bucketSize.has(bucket)) bucketSize.set(bucket, new Map())
    const bs = bucketSize.get(bucket)!
    bs.set(size, (bs.get(size) ?? 0) + amount)
  }

  // Build nodes: primes, then categories, then sizes
  const nodes: PrimeFlowNode[] = []
  const nodeIndex = new Map<string, number>()

  for (const prime of topPrimes) {
    nodeIndex.set(`prime:${prime}`, nodes.length)
    nodes.push({name: prime})
  }

  const activeBucketList = defenseMoneyBucketValues.filter((b) => activeBuckets.has(b))

  for (const bucket of activeBucketList) {
    nodeIndex.set(`bucket:${bucket}`, nodes.length)
    nodes.push({
      name: formatDefenseMoneyBucketLabel(bucket),
      colorToken: `var(--${defenseMoneyBucketColorMap[bucket]})`,
    })
  }

  const activeSizes = new Set<string>()

  for (const sizeMap of bucketSize.values()) {
    for (const size of sizeMap.keys()) {
      activeSizes.add(size)
    }
  }

  const sizeOrder = ['<$1M', '$1M–$5M', '$5M–$20M', '$20M+']
  const activeSizeList = sizeOrder.filter((s) => activeSizes.has(s))

  for (const size of activeSizeList) {
    nodeIndex.set(`size:${size}`, nodes.length)
    nodes.push({name: size})
  }

  // Build links
  const totalValue = filteredTxns.reduce((sum, t) => sum + toNumber(t.transaction_amount), 0)
  const noiseThreshold = totalValue * 0.01
  const links: PrimeFlowLink[] = []

  for (const prime of topPrimes) {
    const buckets = primeBucket.get(prime) ?? new Map()
    for (const [bucket, value] of buckets) {
      if (value < noiseThreshold) continue
      const source = nodeIndex.get(`prime:${prime}`)
      const target = nodeIndex.get(`bucket:${bucket}`)
      if (source !== undefined && target !== undefined) {
        links.push({source, target, value: Math.round(value)})
      }
    }
  }

  for (const [bucket, sizes] of bucketSize) {
    for (const [size, value] of sizes) {
      if (value < noiseThreshold) continue
      const source = nodeIndex.get(`bucket:${bucket}`)
      const target = nodeIndex.get(`size:${size}`)
      if (source !== undefined && target !== undefined) {
        links.push({source, target, value: Math.round(value)})
      }
    }
  }

  return {
    nodes,
    links,
    insufficientData: topPrimes.length < 5,
  }
}

export async function getDefenseMoneyChartsData(options?: {date?: string}): Promise<DefenseMoneyChartData> {
  const config = getDefenseMoneySignalsConfig()
  const targetDate = compact(options?.date) || priorBusinessDayEt()

  if (!config.enabled) {
    return emptyChartData(targetDate)
  }

  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return emptyChartData(targetDate)
  }

  const awardsStart = shiftIsoDate(targetDate, -45)
  const marketStart = shiftIsoDate(targetDate, -31)

  const [awardsResult, weeklyRollupsResult, monthlyRollupsResult, marketResult, macroResult, latestAwardsResult, latestRollupsResult, latestMarketResult] =
    await Promise.all([
      supabase
        .from('defense_money_award_transactions')
        .select('action_date, transaction_amount, recipient_name, award_id, source_url, bucket_primary')
        .gte('action_date', awardsStart)
        .lte('action_date', targetDate)
        .order('action_date', {ascending: false})
        .limit(2000)
        .returns<AwardRow[]>(),
      supabase
        .from('defense_money_rollups')
        .select('period_start, period_end, total_obligations, award_count, top5_concentration, category_share, top_recipients')
        .eq('period_type', 'week')
        .lte('period_start', targetDate)
        .order('period_start', {ascending: false})
        .limit(16)
        .returns<RollupRow[]>(),
      supabase
        .from('defense_money_rollups')
        .select('period_start, period_end, total_obligations, award_count, top5_concentration, category_share, top_recipients')
        .eq('period_type', 'month')
        .lte('period_start', targetDate)
        .order('period_start', {ascending: false})
        .limit(16)
        .returns<RollupRow[]>(),
      supabase
        .from('defense_money_market_quotes')
        .select('ticker, trade_date, price, change_percent, source_url, context_url, context_headline')
        .gte('trade_date', marketStart)
        .lte('trade_date', targetDate)
        .order('trade_date', {ascending: true})
        .limit(1000)
        .returns<MarketQuoteRow[]>(),
      supabase
        .from('defense_money_macro_context')
        .select('effective_week_start, headline, summary, so_what, source_label, source_url, tags, is_active')
        .eq('is_active', true)
        .lte('effective_week_start', targetDate)
        .order('effective_week_start', {ascending: false})
        .limit(1)
        .returns<MacroRow[]>(),
      supabase
        .from('defense_money_award_transactions')
        .select('action_date')
        .order('action_date', {ascending: false})
        .limit(1)
        .returns<DateRow[]>(),
      supabase
        .from('defense_money_rollups')
        .select('period_start')
        .eq('period_type', 'week')
        .order('period_start', {ascending: false})
        .limit(1)
        .returns<DateRow[]>(),
      supabase
        .from('defense_money_market_quotes')
        .select('trade_date')
        .order('trade_date', {ascending: false})
        .limit(1)
        .returns<DateRow[]>(),
    ])

  const awards = normalizeAwards(awardsResult.data ?? [])
  const weeklyRollups = normalizeRollups(weeklyRollupsResult.data ?? [], 'week')
  const monthlyRollups = normalizeRollups(monthlyRollupsResult.data ?? [], 'month')
  const marketQuotes = normalizeMarket(marketResult.data ?? [])
  const activeMacro = normalizeMacro((macroResult.data ?? [])[0] ?? null)

  return buildDefenseMoneyChartsDataFromRows({
    targetDate,
    awardTransactions: awards,
    weeklyRollups,
    monthlyRollups,
    marketQuotes,
    activeMacro,
    marketTickers: config.marketTickers,
    latestDates: {
      awards: compact((latestAwardsResult.data ?? [])[0]?.action_date),
      weeklyRollups: compact((latestRollupsResult.data ?? [])[0]?.period_start),
      market: compact((latestMarketResult.data ?? [])[0]?.trade_date),
      macro: activeMacro?.effectiveWeekStart ?? null,
    },
  })
}
