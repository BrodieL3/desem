import {createOptionalSupabaseServerClient} from '@/lib/supabase/server'

export type GprPoint = {
  periodDate: string
  gpr: number
  gprt: number | null
  gpra: number | null
}

export type GprLevel = 'low' | 'elevated' | 'high'

export type GprSummary = {
  latest: GprPoint | null
  prior: GprPoint | null
  sparkline: GprPoint[]
  delta: number | null
  deltaPercent: number | null
  level: GprLevel
}

type GprRow = {
  period_date: string
  gpr: number
  gprt: number | null
  gpra: number | null
}

function classifyLevel(gpr: number): GprLevel {
  if (gpr >= 150) {
    return 'high'
  }

  if (gpr >= 100) {
    return 'elevated'
  }

  return 'low'
}

function mapRow(row: GprRow): GprPoint {
  return {
    periodDate: row.period_date,
    gpr: Number(row.gpr),
    gprt: row.gprt !== null ? Number(row.gprt) : null,
    gpra: row.gpra !== null ? Number(row.gpra) : null,
  }
}

function emptyGprSummary(): GprSummary {
  return {
    latest: null,
    prior: null,
    sparkline: [],
    delta: null,
    deltaPercent: null,
    level: 'low',
  }
}

export async function getGprData(): Promise<GprSummary> {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return emptyGprSummary()
  }

  const {data} = await supabase
    .from('macro_gpr')
    .select('period_date, gpr, gprt, gpra')
    .order('period_date', {ascending: false})
    .limit(24)
    .returns<GprRow[]>()

  const rows = data ?? []

  if (rows.length === 0) {
    return emptyGprSummary()
  }

  const latest = mapRow(rows[0]!)
  const prior = rows.length >= 2 ? mapRow(rows[1]!) : null

  const delta = prior ? Math.round((latest.gpr - prior.gpr) * 10000) / 10000 : null
  const deltaPercent = prior && prior.gpr > 0 ? Math.round(((latest.gpr - prior.gpr) / prior.gpr) * 10000) / 100 : null

  const sparkline = [...rows].reverse().map(mapRow)

  return {
    latest,
    prior,
    sparkline,
    delta,
    deltaPercent,
    level: classifyLevel(latest.gpr),
  }
}
