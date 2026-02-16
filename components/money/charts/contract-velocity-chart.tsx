'use client'

import {Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'

type ContractVelocityPoint = {
  date: string
  usaspending: number
  defenseGov: number
}

type ContractVelocityChartProps = {
  points: ContractVelocityPoint[]
  stale: boolean
  gapAnnotation?: string | null
}

function formatAxisDollars(value: number) {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)}M`
  }

  return `$${value.toFixed(0)}`
}

function formatTooltipValue(value: number | string | Array<number | string>) {
  if (Array.isArray(value)) {
    return String(value[0] ?? '')
  }

  if (typeof value === 'string') {
    return value
  }

  return value.toLocaleString(undefined, {maximumFractionDigits: 0})
}

export function ContractVelocityChart({points, stale, gapAnnotation}: ContractVelocityChartProps) {
  const hasData = points.length >= 2

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.45rem] leading-tight">Contract velocity</CardTitle>
        <p className="text-muted-foreground text-sm">
          Dual-source contract obligations: USAspending (historical) + Defense.gov (recent).
          {stale ? ' Data is stale.' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <p className="text-muted-foreground text-sm">Insufficient data. Need at least two data points.</p>
        ) : (
          <div className="h-[260px] w-full" role="img" aria-label="Contract velocity chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{top: 8, right: 10, left: 0, bottom: 0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{fill: 'var(--muted-foreground)', fontSize: 11}} minTickGap={24} />
                <YAxis
                  tick={{fill: 'var(--muted-foreground)', fontSize: 11}}
                  tickFormatter={formatAxisDollars}
                  width={58}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.6rem',
                    fontSize: '0.85rem',
                  }}
                  formatter={(value, name) => [
                    formatTooltipValue(value as string | number),
                    name === 'usaspending' ? 'USAspending' : 'Defense.gov',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="usaspending"
                  stroke="var(--chart-1)"
                  fill="color-mix(in oklch, var(--chart-1), transparent 70%)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="defenseGov"
                  stroke="var(--chart-3)"
                  fill="color-mix(in oklch, var(--chart-3), transparent 70%)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {gapAnnotation ? (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{gapAnnotation}</p>
        ) : null}

        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{background: 'var(--chart-1)'}} />
            USAspending
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{background: 'var(--chart-3)'}} />
            Defense.gov
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
