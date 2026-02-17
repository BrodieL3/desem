import {createOptionalSupabaseServerClient} from '@/lib/supabase/server'

import {formatDefenseMoneyBucketLabel} from './chart-colors'
import type {DefenseMoneyBucket} from './types'

export type AwardMatrixPoint = {
  id: string
  title: string
  recipient: string
  subAgency: string | null
  amount: number
  actionDate: string
  bucket: DefenseMoneyBucket | null
  bucketLabel: string
  sourceUrl: string
  isModification: boolean
}

export type AwardTransactionHistoryPoint = {
  date: string
  amount: number
  description: string
}

export type AwardAmounts = {
  outlayed: number | null
  obligated: number | null
  current: number
  potential: number | null
}

export type AwardMilestones = {
  startDate: string | null
  currentEndDate: string | null
  potentialEndDate: string | null
}

export type AwardTransactionHistory = {
  awardId: string
  recipient: string
  subAgency: string | null
  bucket: DefenseMoneyBucket | null
  bucketLabel: string
  currentAmount: number
  sourceUrl: string
  amounts: AwardAmounts
  milestones: AwardMilestones
  points: AwardTransactionHistoryPoint[]
}

export type AwardMatrixBucketStat = {
  bucket: DefenseMoneyBucket | null
  bucketLabel: string
  amount: number
  count: number
}

export type AwardMatrixStats = {
  totalAmount: number
  totalAwardCount: number
  topRecipients: Array<{recipient: string; amount: number; count: number}>
  bucketBreakdown: AwardMatrixBucketStat[]
}

export type AwardMatrixData = {
  points: AwardMatrixPoint[]
  stats: AwardMatrixStats
  insufficientData: boolean
  startDate: string
  endDate: string
}

type AwardMatrixRow = {
  id: string
  award_id: string
  recipient_name: string
  awarding_agency_name: string
  transaction_amount: number | string
  action_date: string
  bucket_primary: string | null
  transaction_description: string | null
  source_url: string
  modification_number: string | null
  performance_start_date: string | null
}

function shiftMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function truncateDescription(desc: string, max: number) {
  if (desc.length <= max) return desc
  return `${desc.slice(0, max)}...`
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

const EMPTY_STATS: AwardMatrixStats = {
  totalAmount: 0,
  totalAwardCount: 0,
  topRecipients: [],
  bucketBreakdown: [],
}

const TOP_AWARDS = 400
const TOP_RECIPIENTS = 6

type AwardAccumulator = {
  awardId: string
  /** Value from the most recent transaction (current_total_value_of_award) */
  totalAmount: number
  latestDate: string
  earliestDate: string
  recipient: string
  subAgency: string | null
  bucket: DefenseMoneyBucket | null
  description: string
  sourceUrl: string
  /** Contract start date from period_of_performance_start_date */
  performanceStartDate: string | null
}

export async function getAwardMatrixData(options?: {startDate?: string; endDate?: string}): Promise<AwardMatrixData> {
  const today = new Date().toISOString().slice(0, 10)
  const endDate = options?.endDate ?? today
  const startDate = options?.startDate ?? (() => {
    const d = new Date(`${endDate}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 90)
    return d.toISOString().slice(0, 10)
  })()

  const empty: AwardMatrixData = {
    points: [],
    stats: EMPTY_STATS,
    insufficientData: true,
    startDate,
    endDate,
  }

  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return empty
  }

  try {
    const CHUNK_MONTHS = 1
    const ROWS_PER_CHUNK = 1_000
    const MIN_AMOUNT = 10_000_000 // $10M — skip small transactions to keep result sets manageable
    const COLUMNS = 'id, award_id, recipient_name, awarding_agency_name, transaction_amount, action_date, bucket_primary, transaction_description, source_url, modification_number, performance_start_date'

    // Split the date range into 3-month chunks and fetch up to 1000 rows each.
    // This avoids Supabase statement timeouts on large sorts while giving
    // even coverage across the full time range.
    const chunks: [string, string][] = []
    let cursor = startDate
    while (cursor < endDate) {
      const chunkEnd = shiftMonths(cursor, CHUNK_MONTHS)
      chunks.push([cursor, chunkEnd < endDate ? chunkEnd : endDate])
      cursor = chunkEnd
    }

    const chunkResults = await Promise.all(
      chunks.map(async ([chunkStart, chunkEnd]) => {
        const {data, error: chunkError} = await supabase
          .from('defense_money_award_transactions')
          .select(COLUMNS)
          .gte('action_date', chunkStart)
          .lte('action_date', chunkEnd)
          .gte('transaction_amount', MIN_AMOUNT)
          .order('action_date', {ascending: false})
          .limit(ROWS_PER_CHUNK)
          .returns<AwardMatrixRow[]>()

        if (chunkError) {
          console.warn(`[award-matrix] chunk ${chunkStart}→${chunkEnd} error:`, chunkError.message)
          return []
        }
        return data ?? []
      }),
    )

    const allRows = chunkResults.flat()

    // console.log(`[award-matrix] ${chunks.length} chunks for ${startDate} → ${endDate}, total=${allRows.length}`)

    if (allRows.length === 0) {
      return empty
    }

    // --- Aggregate transactions into awards ---
    // transaction_amount is `current_total_value_of_award` — a cumulative
    // running total, NOT an incremental delta. So for each award we take
    // the value from the most recent transaction as the current obligation.
    //
    // Color logic: if performance_start_date falls within the chart's
    // date range → purple (new contract). Otherwise → gray (older contract
    // with ongoing modifications).
    const awardMap = new Map<string, AwardAccumulator>()

    for (const r of allRows) {
      const amount = toNumber(r.transaction_amount)
      if (!r.action_date) continue

      const existing = awardMap.get(r.award_id)

      if (existing) {
        if (!existing.performanceStartDate && r.performance_start_date) {
          existing.performanceStartDate = r.performance_start_date
        }
        if (r.action_date < existing.earliestDate) {
          existing.earliestDate = r.action_date
        }
        if (r.action_date > existing.latestDate) {
          existing.latestDate = r.action_date
          existing.totalAmount = amount
          existing.description = compact(r.transaction_description)
          existing.sourceUrl = compact(r.source_url)
          existing.bucket = r.bucket_primary as DefenseMoneyBucket | null
          existing.subAgency = compact(r.awarding_agency_name) || null
        }
      } else {
        awardMap.set(r.award_id, {
          awardId: r.award_id,
          totalAmount: amount,
          latestDate: r.action_date,
          earliestDate: r.action_date,
          recipient: compact(r.recipient_name),
          subAgency: compact(r.awarding_agency_name) || null,
          bucket: r.bucket_primary as DefenseMoneyBucket | null,
          description: compact(r.transaction_description),
          sourceUrl: compact(r.source_url),
          performanceStartDate: r.performance_start_date || null,
        })
      }
    }

    // --- Build stats from all aggregated awards ---
    const allAwards = [...awardMap.values()].filter((a) => a.totalAmount > 0)

    let totalAmount = 0
    const recipientMap = new Map<string, {amount: number; count: number}>()
    const bucketMap = new Map<string, {bucket: DefenseMoneyBucket | null; amount: number; count: number}>()

    for (const a of allAwards) {
      totalAmount += a.totalAmount

      const rEntry = recipientMap.get(a.recipient)
      if (rEntry) {
        rEntry.amount += a.totalAmount
        rEntry.count++
      } else {
        recipientMap.set(a.recipient, {amount: a.totalAmount, count: 1})
      }

      const bucketKey = a.bucket ?? '__other__'
      const bEntry = bucketMap.get(bucketKey)
      if (bEntry) {
        bEntry.amount += a.totalAmount
        bEntry.count++
      } else {
        bucketMap.set(bucketKey, {bucket: a.bucket, amount: a.totalAmount, count: 1})
      }
    }

    // --- Points: new contracts only, plotted at first action date ---
    const newAwards = allAwards
      .filter((a) => a.performanceStartDate != null && a.performanceStartDate >= startDate)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, TOP_AWARDS)

    const points: AwardMatrixPoint[] = newAwards.map((a) => {
      const bucket = a.bucket
      return {
        id: a.awardId,
        title: truncateDescription(a.description || a.awardId, 120),
        recipient: a.recipient,
        subAgency: a.subAgency,
        amount: a.totalAmount,
        actionDate: a.performanceStartDate!,
        bucket,
        bucketLabel: bucket ? formatDefenseMoneyBucketLabel(bucket) : 'Other',
        sourceUrl: a.sourceUrl,
        isModification: false,
      }
    })

    // --- Build stats ---
    const topRecipients = [...recipientMap.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, TOP_RECIPIENTS)
      .map(([recipient, {amount, count}]) => ({recipient, amount, count}))

    const bucketBreakdown: AwardMatrixBucketStat[] = [...bucketMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .map(({bucket, amount, count}) => ({
        bucket,
        bucketLabel: bucket ? formatDefenseMoneyBucketLabel(bucket) : 'Other',
        amount,
        count,
      }))

    const stats: AwardMatrixStats = {
      totalAmount,
      totalAwardCount: allAwards.length,
      topRecipients,
      bucketBreakdown,
    }

    return {
      points,
      stats,
      insufficientData: points.length === 0,
      startDate,
      endDate,
    }
  } catch {
    return empty
  }
}

type TransactionHistoryRow = {
  action_date: string
  transaction_amount: number | string
  transaction_description: string | null
  recipient_name: string
  awarding_agency_name: string | null
  bucket_primary: string | null
  source_url: string
  outlayed_amount: number | string | null
  obligated_amount: number | string | null
  potential_amount: number | string | null
  performance_start_date: string | null
  performance_current_end_date: string | null
  performance_potential_end_date: string | null
}

export async function getAwardTransactionHistory(awardId: string): Promise<AwardTransactionHistory | null> {
  const supabase = await createOptionalSupabaseServerClient()
  if (!supabase) return null

  const {data: rows} = await supabase
    .from('defense_money_award_transactions')
    .select('action_date, transaction_amount, transaction_description, recipient_name, awarding_agency_name, bucket_primary, source_url, outlayed_amount, obligated_amount, potential_amount, performance_start_date, performance_current_end_date, performance_potential_end_date')
    .eq('award_id', awardId)
    .order('action_date', {ascending: true})
    .returns<TransactionHistoryRow[]>()

  if (!rows || rows.length === 0) return null

  const points: AwardTransactionHistoryPoint[] = rows.map((r) => ({
    date: r.action_date,
    amount: toNumber(r.transaction_amount),
    description: compact(r.transaction_description),
  }))

  const latest = rows[rows.length - 1]
  const bucket = (latest.bucket_primary as DefenseMoneyBucket | null) ?? null
  const currentAmount = toNumber(latest.transaction_amount)

  const amounts: AwardAmounts = {
    outlayed: toNumber(latest.outlayed_amount) || null,
    obligated: toNumber(latest.obligated_amount) || null,
    current: currentAmount,
    potential: toNumber(latest.potential_amount) || null,
  }

  const milestones: AwardMilestones = {
    startDate: latest.performance_start_date || null,
    currentEndDate: latest.performance_current_end_date || null,
    potentialEndDate: latest.performance_potential_end_date || null,
  }

  return {
    awardId,
    recipient: compact(latest.recipient_name),
    subAgency: compact(latest.awarding_agency_name) || null,
    bucket,
    bucketLabel: bucket ? formatDefenseMoneyBucketLabel(bucket) : 'Other',
    currentAmount,
    sourceUrl: compact(latest.source_url),
    amounts,
    milestones,
    points,
  }
}
