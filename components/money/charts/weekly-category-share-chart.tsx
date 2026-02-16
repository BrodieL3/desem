'use client'

import {useMemo} from 'react'
import {Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {defenseMoneyBucketColorMap, defenseMoneyBucketLabelMap} from '@/lib/data/signals/chart-colors'
import {defenseMoneyBucketValues, type DefenseMoneyChartData} from '@/lib/data/signals/types'

import {ChartSummaryBlock} from './chart-summary-block'

type WeeklyCategoryShareChartProps = {
  module: DefenseMoneyChartData['weeklyCategoryShare']
  stale: boolean
}

export function WeeklyCategoryShareChart({module, stale}: WeeklyCategoryShareChartProps) {
  const rows = useMemo(
    () =>
      module.points.map((point) => ({
        periodStart: point.periodStart,
        ...point.categoryShare,
      })),
    [module.points]
  )

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.45rem] leading-tight">Weekly category share</CardTitle>
        <p className="text-muted-foreground text-sm">
          Top-line category share movement across the latest 12 weekly rollups.
          {stale ? ' Data is stale.' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length < 2 ? (
          <p className="text-muted-foreground text-sm">Insufficient trend data. Need at least two weekly points.</p>
        ) : (
          <div className="h-[280px] w-full" role="img" aria-label="Weekly category share chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{top: 12, right: 10, left: 0, bottom: 0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="periodStart" tick={{fill: 'var(--muted-foreground)', fontSize: 11}} minTickGap={28} />
                <YAxis
                  tick={{fill: 'var(--muted-foreground)', fontSize: 11}}
                  width={52}
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.6rem',
                    fontSize: '0.85rem',
                  }}
                  formatter={(value, name) => [`${(Number(value) * 100).toFixed(1)}%`, defenseMoneyBucketLabelMap[name as keyof typeof defenseMoneyBucketLabelMap] ?? String(name)]}
                />
                <Legend wrapperStyle={{fontSize: '0.72rem'}} />
                {defenseMoneyBucketValues.map((bucket) => (
                  <Area
                    key={bucket}
                    type="monotone"
                    dataKey={bucket}
                    name={defenseMoneyBucketLabelMap[bucket]}
                    stackId="weekly-share"
                    stroke={`var(--${defenseMoneyBucketColorMap[bucket]})`}
                    fill={`color-mix(in oklch, var(--${defenseMoneyBucketColorMap[bucket]}), transparent 70%)`}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <ChartSummaryBlock summary={module.summary} />
      </CardContent>
    </Card>
  )
}
