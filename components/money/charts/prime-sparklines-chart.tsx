'use client'

import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {DefenseMoneyChartData} from '@/lib/data/signals/types'

import {ChartSummaryBlock} from './chart-summary-block'

type PrimeSparklinesChartProps = {
  module: DefenseMoneyChartData['primeSparklines']
  stale: boolean
}

function SparklineRow({
  ticker,
  points,
  latestChangePercent,
  coverage,
}: {
  ticker: string
  points: Array<{tradeDate: string; price: number}>
  latestChangePercent: number | null
  coverage: 'full' | 'partial'
}) {
  return (
    <div className="grid grid-cols-[78px_minmax(0,1fr)_84px] items-center gap-3 border-b border-border/70 pb-2 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-foreground">{ticker}</p>
        <p className="text-xs text-muted-foreground">{coverage === 'full' ? 'full' : 'partial'} coverage</p>
      </div>

      {points.length < 2 ? (
        <p className="text-xs text-muted-foreground">Insufficient series</p>
      ) : (
        <div className="h-[58px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{top: 6, right: 2, left: 2, bottom: 0}}>
              <XAxis dataKey="tradeDate" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.6rem',
                  fontSize: '0.8rem',
                }}
                formatter={(value) => [Number(value).toFixed(2), 'Price']}
                labelFormatter={(label) => String(label)}
              />
              <Line type="monotone" dataKey="price" stroke="var(--chart-3)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p
        className={`text-right text-sm ${
          latestChangePercent === null
            ? 'text-muted-foreground'
            : latestChangePercent >= 0
              ? 'text-success-foreground'
              : 'text-warning-foreground'
        }`}
      >
        {latestChangePercent === null ? 'N/D' : `${latestChangePercent >= 0 ? '+' : ''}${latestChangePercent.toFixed(2)}%`}
      </p>
    </div>
  )
}

export function PrimeSparklinesChart({module, stale}: PrimeSparklinesChartProps) {
  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.45rem] leading-tight">Prime sparklines</CardTitle>
        <p className="text-muted-foreground text-sm">
          Trailing month quote context for LMT, RTX, NOC, GD, BA, and LHX.
          {stale ? ' Data is stale.' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {module.tickers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No market quotes available.</p>
        ) : (
          <div className="space-y-2">
            {module.tickers.map((ticker) => (
              <SparklineRow
                key={ticker.ticker}
                ticker={ticker.ticker}
                points={ticker.points}
                latestChangePercent={ticker.latestChangePercent}
                coverage={ticker.coverage}
              />
            ))}
          </div>
        )}

        <ChartSummaryBlock summary={module.summary} />
      </CardContent>
    </Card>
  )
}
