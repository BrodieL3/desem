import {createOptionalSupabaseServerClient} from '@/lib/supabase/server'

import {getDefenseMoneySignalsConfig, isDefenseMoneySignalsEnabled} from './config'
import {isStaleDate, priorBusinessDayEt} from './time'
import type {DefenseMoneyCard, DefenseMoneySignalData} from './types'

type BriefRow = {
  card_key: string
  timeframe: 'daily' | 'weekly' | 'monthly'
  brief_date: string
  generated_mode: 'deterministic' | 'llm'
  action_lens: 'build' | 'sell' | 'partner'
  summary: string
  so_what: string
  citations: unknown
  payload: unknown
}

type MarketDateRow = {
  trade_date: string
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function cardHeadline(cardKey: string, payload: Record<string, unknown>) {
  const payloadHeadline = compact(String(payload.headline ?? ''))

  if (payloadHeadline) {
    return payloadHeadline
  }

  if (cardKey === 'daily_spend_pulse') {
    return 'New Money'
  }

  if (cardKey === 'prime_moves') {
    return 'Prime Moves'
  }

  if (cardKey === 'new_awards') {
    return 'New awards you should know about'
  }

  if (cardKey === 'weekly_structural') {
    return 'Weekly structural shifts'
  }

  if (cardKey === 'monthly_structural') {
    return 'Monthly structural shifts'
  }

  if (cardKey === 'macro_context') {
    return 'Macro budget context'
  }

  return 'Defense money signal'
}

function asArrayOfObjects(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry) => entry && typeof entry === 'object') as Array<Record<string, unknown>>
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return value as Record<string, unknown>
}

function mapBriefRow(row: BriefRow | null): DefenseMoneyCard | null {
  if (!row) {
    return null
  }

  const payload = asRecord(row.payload)
  const citations = asArrayOfObjects(row.citations).map((entry) => ({
    id: compact(String(entry.id ?? '')),
    label: compact(String(entry.label ?? '')),
    url: compact(String(entry.url ?? '')),
    sourceLabel: compact(String(entry.sourceLabel ?? '')) || undefined,
  }))

  return {
    cardKey: row.card_key,
    timeframe: row.timeframe,
    briefDate: row.brief_date,
    headline: cardHeadline(row.card_key, payload),
    summary: row.summary,
    soWhat: row.so_what,
    actionLens: row.action_lens,
    generatedMode: row.generated_mode,
    citations: citations.filter((entry) => entry.id && entry.label && entry.url),
    payload,
  }
}

async function fetchLatestCard(input: {
  cardKey: string
  timeframe: 'daily' | 'weekly' | 'monthly'
  targetDate: string
}) {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return null
  }

  const {data} = await supabase
    .from('defense_money_briefs')
    .select('card_key, timeframe, brief_date, generated_mode, action_lens, summary, so_what, citations, payload')
    .eq('card_key', input.cardKey)
    .eq('timeframe', input.timeframe)
    .lte('brief_date', input.targetDate)
    .order('brief_date', {ascending: false})
    .limit(1)
    .returns<BriefRow[]>()

  return mapBriefRow((data ?? [])[0] ?? null)
}

async function fetchLatestMarketDate() {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return null
  }

  const {data} = await supabase
    .from('defense_money_market_quotes')
    .select('trade_date')
    .order('trade_date', {ascending: false})
    .limit(1)
    .returns<MarketDateRow[]>()

  return data?.[0]?.trade_date ?? null
}

function emptySignals(): DefenseMoneySignalData {
  return {
    generatedAt: new Date().toISOString(),
    dailySpendPulse: null,
    primeMoves: null,
    newAwards: null,
    weeklyStructural: null,
    monthlyStructural: null,
    macroContext: null,
    staleData: {
      daily: true,
      weekly: true,
      monthly: true,
      market: true,
    },
  }
}

export {isDefenseMoneySignalsEnabled}

export async function getDefenseMoneySignalData(options?: {date?: string}): Promise<DefenseMoneySignalData> {
  const config = getDefenseMoneySignalsConfig()

  if (!config.enabled) {
    return emptySignals()
  }

  const targetDate = compact(options?.date) || priorBusinessDayEt()

  const [dailySpendPulse, primeMoves, newAwards, weeklyStructural, monthlyStructural, macroContext, latestMarketDate] =
    await Promise.all([
      fetchLatestCard({
        cardKey: 'daily_spend_pulse',
        timeframe: 'daily',
        targetDate,
      }),
      fetchLatestCard({
        cardKey: 'prime_moves',
        timeframe: 'daily',
        targetDate,
      }),
      fetchLatestCard({
        cardKey: 'new_awards',
        timeframe: 'daily',
        targetDate,
      }),
      fetchLatestCard({
        cardKey: 'weekly_structural',
        timeframe: 'weekly',
        targetDate,
      }),
      fetchLatestCard({
        cardKey: 'monthly_structural',
        timeframe: 'monthly',
        targetDate,
      }),
      fetchLatestCard({
        cardKey: 'macro_context',
        timeframe: 'weekly',
        targetDate,
      }),
      fetchLatestMarketDate(),
    ])

  return {
    generatedAt: new Date().toISOString(),
    dailySpendPulse,
    primeMoves,
    newAwards,
    weeklyStructural,
    monthlyStructural,
    macroContext,
    staleData: {
      daily: isStaleDate(dailySpendPulse?.briefDate, 2),
      weekly: isStaleDate(weeklyStructural?.briefDate, 10),
      monthly: isStaleDate(monthlyStructural?.briefDate, 40),
      market: isStaleDate(latestMarketDate, 4),
    },
  }
}
