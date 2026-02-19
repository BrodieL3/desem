'use client'

import {useState} from 'react'
import Link from 'next/link'
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {DefenseMoneyChartData, DefenseMoneyPrimeSparkline} from '@/lib/data/signals/types'

type Timeframe = '1D' | '1W' | '1M'

type PrimeSparklinesChartProps = {
  module: DefenseMoneyChartData['primeSparklines']
  stale: boolean
}

function filterPoints(points: DefenseMoneyPrimeSparkline['points'], timeframe: Timeframe) {
  if (timeframe === '1D') return points.slice(-2)
  if (timeframe === '1W') return points.slice(-5)
  return points
}

function periodChangePercent(points: DefenseMoneyPrimeSparkline['points']) {
  if (points.length < 2) return null
  const first = points[0].price
  const last = points[points.length - 1].price
  if (first === 0) return null
  return ((last - first) / first) * 100
}

const timeframeLabel: Record<Timeframe, string> = {
  '1D': 'Today',
  '1W': '7-day',
  '1M': '30-day',
}

function SparklineRow({
  ticker,
  points,
  changePercent,
  timeframe,
}: {
  ticker: string
  points: Array<{tradeDate: string; price: number}>
  changePercent: number | null
  timeframe: Timeframe
}) {
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)_84px] items-center gap-3 border-b border-border/70 pb-2 last:border-b-0">
      <p className="text-sm font-medium text-foreground">{ticker}</p>

      {points.length < 2 ? (
        <p className="text-xs text-muted-foreground">Awaiting data</p>
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
              <Line
                type="monotone"
                dataKey="price"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p
        className={`text-right text-sm tabular-nums ${
          changePercent === null
            ? 'text-muted-foreground'
            : changePercent >= 0
              ? 'text-success-foreground'
              : 'text-warning-foreground'
        }`}
      >
        {changePercent === null ? 'N/D' : `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`}
      </p>
    </div>
  )
}

export function PrimeSparklinesChart({module, stale}: PrimeSparklinesChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1M')

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-[1.45rem] leading-tight">Prime sparklines</CardTitle>
          <div className="flex gap-1">
            {(['1D', '1W', '1M'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          {timeframeLabel[timeframe]} defense prime quotes{stale ? ' · Refresh at 11 AM UTC' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {module.tickers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No market quotes available.</p>
        ) : (
          <div className="space-y-2">
            {module.tickers.map((ticker) => {
              const filtered = filterPoints(ticker.points, timeframe)
              const change = timeframe === '1D'
                ? ticker.latestChangePercent
                : periodChangePercent(filtered)

              return (
                <SparklineRow
                  key={ticker.ticker}
                  ticker={ticker.ticker}
                  points={filtered}
                  changePercent={change}
                  timeframe={timeframe}
                />
              )
            })}
          </div>
        )}

        <p className="text-muted-foreground text-xs">
          Data by{' '}
          <Link
            href="https://finnhub.io"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            Finnhub
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
