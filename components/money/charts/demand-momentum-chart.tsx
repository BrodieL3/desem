'use client'

import {Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {DefenseMoneyChartData} from '@/lib/data/signals/types'

import {ChartSummaryBlock} from './chart-summary-block'

type DemandMomentumChartProps = {
  module: DefenseMoneyChartData['demandMomentum']
  stale: boolean
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

export function DemandMomentumChart({module, stale}: DemandMomentumChartProps) {
  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.45rem] leading-tight">Demand momentum</CardTitle>
        <p className="text-muted-foreground text-sm">
          Trailing 20 business-day DoD obligations with daily award count context.
          {stale ? ' Data is stale.' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {module.points.length < 2 ? (
          <p className="text-muted-foreground text-sm">Insufficient trend data. Need at least two business-day points.</p>
        ) : (
          <div className="h-[260px] w-full" role="img" aria-label="Demand momentum chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={module.points} margin={{top: 8, right: 10, left: 0, bottom: 0}}>
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
                  formatter={(value) => [formatTooltipValue(value as string | number), 'Obligations']}
                />
                <Area
                  type="monotone"
                  dataKey="totalObligations"
                  stroke="var(--chart-1)"
                  fill="color-mix(in oklch, var(--chart-1), transparent 70%)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <ChartSummaryBlock summary={module.summary} />
      </CardContent>
    </Card>
  )
}
