import {createOptionalSupabaseServerClient} from '@/lib/supabase/server'

import {formatDefenseMoneyBucketLabel} from './chart-colors'
import {shiftIsoDate} from './time'
import type {DefenseMoneyBucket} from './types'

type SamGovOpportunityRow = {
  opportunity_id: string
  notice_type: string
  title: string
  solicitation_number: string | null
  department: string | null
  sub_tier: string | null
  office: string | null
  posted_date: string
  response_deadline: string | null
  estimated_value_low: number | null
  estimated_value_high: number | null
  bucket_primary: DefenseMoneyBucket | null
  bucket_tags: string[] | null
  source_url: string
}

export type SamGovPipelineOpportunity = {
  opportunityId: string
  noticeType: string
  title: string
  solicitationNumber: string | null
  department: string | null
  subTier: string | null
  office: string | null
  postedDate: string
  responseDeadline: string | null
  estimatedValueLow: number | null
  estimatedValueHigh: number | null
  bucketPrimary: DefenseMoneyBucket | null
  sourceUrl: string
}

export type SamGovPipelineBucketSummary = {
  bucket: DefenseMoneyBucket
  bucketLabel: string
  count: number
  estimatedValue: number
}

export type SamGovPipelineData = {
  activeSolicitations: SamGovPipelineOpportunity[]
  recentPresolicitations: SamGovPipelineOpportunity[]
  pipelineByBucket: SamGovPipelineBucketSummary[]
  totalActive: number
  totalEstimatedValue: number
  generatedAt: string
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeRow(row: SamGovOpportunityRow): SamGovPipelineOpportunity {
  return {
    opportunityId: compact(row.opportunity_id),
    noticeType: compact(row.notice_type),
    title: compact(row.title),
    solicitationNumber: compact(row.solicitation_number) || null,
    department: compact(row.department) || null,
    subTier: compact(row.sub_tier) || null,
    office: compact(row.office) || null,
    postedDate: compact(row.posted_date),
    responseDeadline: compact(row.response_deadline) || null,
    estimatedValueLow: toNumber(row.estimated_value_low),
    estimatedValueHigh: toNumber(row.estimated_value_high),
    bucketPrimary: row.bucket_primary ?? null,
    sourceUrl: compact(row.source_url),
  }
}

function emptyPipelineData(): SamGovPipelineData {
  return {
    activeSolicitations: [],
    recentPresolicitations: [],
    pipelineByBucket: [],
    totalActive: 0,
    totalEstimatedValue: 0,
    generatedAt: new Date().toISOString(),
  }
}

export type OpportunityMatrixPoint = {
  id: string
  title: string
  noticeType: string
  department: string | null
  daysUntilDeadline: number
  estimatedValue: number | null
  bucket: DefenseMoneyBucket | null
  bucketLabel: string
  competitionLevel: number
  sourceUrl: string
}

export type OpportunityMatrixData = {
  points: OpportunityMatrixPoint[]
  solicitationCount: number
  presolicitationCount: number
  totalEstimatedValue: number
  insufficientData: boolean
}

function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`)
  const b = new Date(`${to}T00:00:00Z`)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export async function getOpportunityMatrixData(options?: {date?: string}): Promise<OpportunityMatrixData> {
  const empty: OpportunityMatrixData = {
    points: [],
    solicitationCount: 0,
    presolicitationCount: 0,
    totalEstimatedValue: 0,
    insufficientData: true,
  }

  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return empty
  }

  const today = options?.date ?? new Date().toISOString().slice(0, 10)

  const {data: rows} = await supabase
    .from('sam_gov_opportunities')
    .select(
      'opportunity_id, notice_type, title, department, response_deadline, estimated_value_low, estimated_value_high, bucket_primary, source_url'
    )
    .in('notice_type', ['solicitation', 'presolicitation'])
    .gte('response_deadline', today)
    .order('response_deadline', {ascending: true})
    .limit(100)
    .returns<SamGovOpportunityRow[]>()

  const opps = rows ?? []

  if (opps.length === 0) {
    return empty
  }

  // Count opps per bucket for competition level
  const bucketCounts = new Map<string, number>()

  for (const opp of opps) {
    if (opp.bucket_primary) {
      bucketCounts.set(opp.bucket_primary, (bucketCounts.get(opp.bucket_primary) ?? 0) + 1)
    }
  }

  let totalEstimatedValue = 0
  let solicitationCount = 0
  let presolicitationCount = 0

  const points: OpportunityMatrixPoint[] = opps.map((opp) => {
    const estimatedValue = toNumber(opp.estimated_value_high) ?? toNumber(opp.estimated_value_low) ?? null
    if (estimatedValue) totalEstimatedValue += estimatedValue
    if (opp.notice_type === 'solicitation') solicitationCount += 1
    if (opp.notice_type === 'presolicitation') presolicitationCount += 1

    return {
      id: compact(opp.opportunity_id),
      title: compact(opp.title),
      noticeType: compact(opp.notice_type),
      department: compact(opp.department) || null,
      daysUntilDeadline: opp.response_deadline ? daysBetween(today, opp.response_deadline) : 0,
      estimatedValue,
      bucket: opp.bucket_primary ?? null,
      bucketLabel: opp.bucket_primary ? formatDefenseMoneyBucketLabel(opp.bucket_primary) : 'Uncategorized',
      competitionLevel: opp.bucket_primary ? (bucketCounts.get(opp.bucket_primary) ?? 1) : 1,
      sourceUrl: compact(opp.source_url),
    }
  })

  return {
    points,
    solicitationCount,
    presolicitationCount,
    totalEstimatedValue,
    insufficientData: points.length === 0,
  }
}

export async function getSamGovPipelineData(options?: {date?: string}): Promise<SamGovPipelineData> {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return emptyPipelineData()
  }

  const today = options?.date ?? new Date().toISOString().slice(0, 10)
  const sevenDaysAgo = shiftIsoDate(today, -7)

  const [solicitationsResult, presolicitationsResult] = await Promise.all([
    supabase
      .from('sam_gov_opportunities')
      .select(
        'opportunity_id, notice_type, title, solicitation_number, department, sub_tier, office, posted_date, response_deadline, estimated_value_low, estimated_value_high, bucket_primary, bucket_tags, source_url'
      )
      .eq('notice_type', 'solicitation')
      .gte('response_deadline', today)
      .order('response_deadline', {ascending: true})
      .limit(50)
      .returns<SamGovOpportunityRow[]>(),
    supabase
      .from('sam_gov_opportunities')
      .select(
        'opportunity_id, notice_type, title, solicitation_number, department, sub_tier, office, posted_date, response_deadline, estimated_value_low, estimated_value_high, bucket_primary, bucket_tags, source_url'
      )
      .eq('notice_type', 'presolicitation')
      .gte('posted_date', sevenDaysAgo)
      .order('posted_date', {ascending: false})
      .limit(50)
      .returns<SamGovOpportunityRow[]>(),
  ])

  const activeSolicitations = (solicitationsResult.data ?? []).map(normalizeRow)
  const recentPresolicitations = (presolicitationsResult.data ?? []).map(normalizeRow)

  const allOpps = [...activeSolicitations, ...recentPresolicitations]
  const bucketCounts = new Map<DefenseMoneyBucket, {count: number; estimatedValue: number}>()

  for (const opp of allOpps) {
    if (!opp.bucketPrimary) {
      continue
    }

    const current = bucketCounts.get(opp.bucketPrimary) ?? {count: 0, estimatedValue: 0}
    current.count += 1
    current.estimatedValue += opp.estimatedValueHigh ?? opp.estimatedValueLow ?? 0
    bucketCounts.set(opp.bucketPrimary, current)
  }

  const pipelineByBucket: SamGovPipelineBucketSummary[] = [...bucketCounts.entries()]
    .map(([bucket, value]) => ({
      bucket,
      bucketLabel: formatDefenseMoneyBucketLabel(bucket),
      count: value.count,
      estimatedValue: value.estimatedValue,
    }))
    .sort((left, right) => right.count - left.count)

  const totalEstimatedValue = pipelineByBucket.reduce((sum, entry) => sum + entry.estimatedValue, 0)

  return {
    activeSolicitations,
    recentPresolicitations,
    pipelineByBucket,
    totalActive: allOpps.length,
    totalEstimatedValue,
    generatedAt: new Date().toISOString(),
  }
}
