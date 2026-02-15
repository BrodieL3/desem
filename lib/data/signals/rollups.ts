import type {SupabaseClient} from '@supabase/supabase-js'

import {defenseMoneyBucketValues, type DefenseMoneyAwardTransaction, type DefenseMoneyBucket, type DefenseMoneyRollup} from './types'
import {monthEndIso, monthStartIso, weekEndIso, weekStartIso} from './time'

type GroupedRollup = {
  periodType: 'week' | 'month'
  periodStart: string
  periodEnd: string
  rows: DefenseMoneyAwardTransaction[]
}

function categoryTotals(rows: DefenseMoneyAwardTransaction[]) {
  const totals: Record<DefenseMoneyBucket, number> = {
    ai_ml: 0,
    c5isr: 0,
    space: 0,
    autonomy: 0,
    cyber: 0,
    munitions: 0,
    ew: 0,
    counter_uas: 0,
  }

  for (const row of rows) {
    totals[row.bucketPrimary] += row.transactionAmount
  }

  return totals
}

function rollupFromGroup(group: GroupedRollup): DefenseMoneyRollup {
  const totalObligations = group.rows.reduce((sum, row) => sum + row.transactionAmount, 0)
  const categoryAmount = categoryTotals(group.rows)

  const categoryShare = defenseMoneyBucketValues.reduce((acc, bucket) => {
    const share = totalObligations > 0 ? categoryAmount[bucket] / totalObligations : 0
    acc[bucket] = Number(share.toFixed(6))
    return acc
  }, {} as Record<DefenseMoneyBucket, number>)

  const recipientTotals = new Map<string, number>()

  for (const row of group.rows) {
    recipientTotals.set(row.recipientName, (recipientTotals.get(row.recipientName) ?? 0) + row.transactionAmount)
  }

  const topRecipients = [...recipientTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([recipientName, amount]) => ({
      recipientName,
      amount,
      share: totalObligations > 0 ? Number((amount / totalObligations).toFixed(6)) : 0,
    }))

  const top5Amount = topRecipients.reduce((sum, row) => sum + row.amount, 0)
  const top5Concentration = totalObligations > 0 ? Number((top5Amount / totalObligations).toFixed(6)) : 0

  return {
    periodType: group.periodType,
    periodStart: group.periodStart,
    periodEnd: group.periodEnd,
    totalObligations: Number(totalObligations.toFixed(2)),
    awardCount: group.rows.length,
    top5Concentration,
    categoryShare,
    topRecipients,
    payload: {
      categoryAmount,
    },
  }
}

function groupTransactions(
  transactions: DefenseMoneyAwardTransaction[],
  periodType: 'week' | 'month'
): GroupedRollup[] {
  const grouped = new Map<string, GroupedRollup>()

  for (const transaction of transactions) {
    const periodStart = periodType === 'week' ? weekStartIso(transaction.actionDate) : monthStartIso(transaction.actionDate)
    const periodEnd = periodType === 'week' ? weekEndIso(transaction.actionDate) : monthEndIso(transaction.actionDate)
    const key = `${periodType}:${periodStart}`

    const current = grouped.get(key) ?? {
      periodType,
      periodStart,
      periodEnd,
      rows: [],
    }

    current.rows.push(transaction)
    grouped.set(key, current)
  }

  return [...grouped.values()].sort((left, right) => Date.parse(right.periodStart) - Date.parse(left.periodStart))
}

export function buildDefenseMoneyRollups(transactions: DefenseMoneyAwardTransaction[]) {
  const weekly = groupTransactions(transactions, 'week').map(rollupFromGroup)
  const monthly = groupTransactions(transactions, 'month').map(rollupFromGroup)

  return {
    weekly,
    monthly,
  }
}

export async function upsertDefenseMoneyRollups(supabase: SupabaseClient, input: {runId: string | null; rollups: DefenseMoneyRollup[]}) {
  if (input.rollups.length === 0) {
    return 0
  }

  const rows = input.rollups.map((rollup) => ({
    run_id: input.runId,
    period_type: rollup.periodType,
    period_start: rollup.periodStart,
    period_end: rollup.periodEnd,
    total_obligations: rollup.totalObligations,
    award_count: rollup.awardCount,
    top5_concentration: rollup.top5Concentration,
    category_share: rollup.categoryShare,
    top_recipients: rollup.topRecipients,
    payload: rollup.payload ?? {},
  }))

  const {error} = await supabase.from('defense_money_rollups').upsert(rows, {
    onConflict: 'period_type,period_start,period_end',
  })

  if (error) {
    throw new Error(`Unable to upsert defense money rollups: ${error.message}`)
  }

  return rows.length
}
