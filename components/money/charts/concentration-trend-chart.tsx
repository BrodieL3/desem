'use client'

import {CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {DefenseMoneyChartData} from '@/lib/data/signals/types'

import {ChartSummaryBlock} from './chart-summary-block'

type ConcentrationTrendChartProps = {
  module: DefenseMoneyChartData['concentrationTrend']
  stale: boolean
}

function ConcentrationMiniChart({
  title,
  data,
  colorToken,
}: {
  title: string
  data: Array<{periodStart: string; top5Concentration: number}>
  colorToken: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs tracking-[0.12em] uppercase">{title}</p>
      {data.length < 2 ? (
        <p className="text-muted-foreground text-sm">Need at least two points.</p>
      ) : (
        <div className="h-[170px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{top: 8, right: 8, left: 0, bottom: 0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="periodStart" tick={{fill: 'var(--muted-foreground)', fontSize: 11}} minTickGap={18} />
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
                formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, 'Top-5 concentration']}
              />
              <Line
                type="monotone"
                dataKey="top5Concentration"
                stroke={`var(--${colorToken})`}
                strokeWidth={2}
                dot={{r: 2}}
                activeDot={{r: 4}}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export function ConcentrationTrendChart({module, stale}: ConcentrationTrendChartProps) {
  return (
    <Card className="rounded-lg border border-border bg-card xl:col-span-2">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.45rem] leading-tight">Concentration trend</CardTitle>
        <p className="text-muted-foreground text-sm">
          Top-5 recipient concentration across weekly and monthly windows.
          {stale ? ' Data is stale.' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <ConcentrationMiniChart title="Weekly (12 points)" data={module.weekly} colorToken="chart-6" />
          <ConcentrationMiniChart title="Monthly (12 points)" data={module.monthly} colorToken="chart-7" />
        </div>

        <ChartSummaryBlock summary={module.summary} />
      </CardContent>
    </Card>
  )
}
