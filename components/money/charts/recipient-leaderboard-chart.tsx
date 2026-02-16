'use client'

import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {DefenseMoneyChartData} from '@/lib/data/signals/types'

import {ChartSummaryBlock} from './chart-summary-block'

type RecipientLeaderboardChartProps = {
  module: DefenseMoneyChartData['recipientLeaderboard']
  stale: boolean
}

function shortName(value: string, maxLength = 22) {
  const normalized = value.trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

function formatCurrency(value: number) {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)}M`
  }

  return `$${value.toFixed(0)}`
}

export function RecipientLeaderboardChart({module, stale}: RecipientLeaderboardChartProps) {
  const chartRows = module.items.slice(0, 8).map((item) => ({
    ...item,
    label: shortName(item.recipientName),
  }))

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.45rem] leading-tight">Recipient leaderboard</CardTitle>
        <p className="text-muted-foreground text-sm">
          Top recipients over the trailing 30-day obligation window.
          {stale ? ' Update pending — next refresh at 11:00 AM UTC.' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {chartRows.length < 2 ? (
          <p className="text-muted-foreground text-sm">Not enough recipient data yet to display a leaderboard.</p>
        ) : (
          <div className="h-[280px] w-full" role="img" aria-label="Recipient leaderboard chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} layout="vertical" margin={{top: 8, right: 8, left: 0, bottom: 0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  tick={{fill: 'var(--muted-foreground)', fontSize: 11}}
                  tickFormatter={(value) => formatCurrency(Number(value))}
                />
                <YAxis dataKey="label" type="category" width={140} tick={{fill: 'var(--muted-foreground)', fontSize: 11}} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.6rem',
                    fontSize: '0.85rem',
                  }}
                  formatter={(value, _name, payload) => {
                    const row = payload?.payload as {share?: number; awardCount?: number}
                    const share = typeof row?.share === 'number' ? `${(row.share * 100).toFixed(1)}%` : 'N/D'
                    const awardCount = typeof row?.awardCount === 'number' ? row.awardCount : 'N/D'
                    return [`${formatCurrency(Number(value))} · ${share} · ${awardCount} awards`, 'Total obligations']
                  }}
                />
                <Bar dataKey="totalObligations" fill="var(--chart-4)" radius={[0, 6, 6, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <ChartSummaryBlock summary={module.summary} />
      </CardContent>
    </Card>
  )
}
