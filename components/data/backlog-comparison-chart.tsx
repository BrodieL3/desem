'use client'

import {useMemo} from 'react'
import {Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'

import type {PrimeBacklogComparisonChartProps} from './types'

type BacklogRow = {
  ticker: string
  companyName: string
  value: number | null
  yoyDelta: number | null
  colorToken: string
}

function parseQuarterLabel(value: string) {
  const match = value.match(/Q([1-4])\s+(\d{4})/)

  if (!match) {
    return null
  }

  return {
    quarter: Number.parseInt(match[1] ?? '0', 10),
    year: Number.parseInt(match[2] ?? '0', 10),
  }
}

function formatValue(value: number | null) {
  if (value === null) {
    return 'N/D'
  }

  return `${value.toFixed(1)}B`
}

function buildRows(input: PrimeBacklogComparisonChartProps): BacklogRow[] {
  const byTicker = new Map<string, typeof input.points>()

  for (const point of input.points) {
    const rows = byTicker.get(point.ticker) ?? []
    rows.push(point)
    byTicker.set(point.ticker, rows)
  }

  return input.companies.map((company) => {
    const points = [...(byTicker.get(company.ticker) ?? [])].sort(
      (left, right) => Date.parse(right.periodEnd) - Date.parse(left.periodEnd)
    )
    const latest = points[0]

    if (!latest) {
      return {
        ticker: company.ticker,
        companyName: company.name,
        value: null,
        yoyDelta: null,
        colorToken: company.colorToken,
      }
    }

    const latestQuarter = parseQuarterLabel(latest.periodLabel)
    const yearAgo = points.find((point) => {
      if (!latestQuarter) {
        return false
      }

      const token = parseQuarterLabel(point.periodLabel)

      if (!token) {
        return false
      }

      return token.quarter === latestQuarter.quarter && token.year === latestQuarter.year - 1
    })

    const yoyDelta = latest.value !== null && yearAgo?.value !== null ? Number((latest.value - yearAgo.value).toFixed(2)) : null

    return {
      ticker: company.ticker,
      companyName: company.name,
      value: latest.value,
      yoyDelta,
      colorToken: company.colorToken,
    }
  })
}

export function BacklogComparisonChart({companies, points}: PrimeBacklogComparisonChartProps) {
  const rows = useMemo(() => buildRows({companies, points}), [companies, points])

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.65rem] leading-tight">Latest backlog comparison</CardTitle>
        <p className="text-muted-foreground text-sm">Latest reported consolidated backlog by company with YoY delta.</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Backlog comparison is unavailable.</p>
        ) : (
          <>
            <div className="h-[320px] w-full" role="img" aria-label="Latest backlog comparison">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="ticker" tick={{fill: 'var(--muted-foreground)', fontSize: 12}} />
                  <YAxis tick={{fill: 'var(--muted-foreground)', fontSize: 12}} tickFormatter={(value) => `${value}B`} width={58} />
                  <Tooltip
                    formatter={(value: number | null) => [formatValue(value), 'Backlog']}
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '0.6rem',
                      fontSize: '0.85rem',
                    }}
                  />
                  <Bar dataKey="value" isAnimationActive={false} radius={[6, 6, 0, 0]}>
                    {rows.map((entry) => (
                      <Cell key={entry.ticker} fill={`var(--${entry.colorToken})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {rows.map((row) => (
                <div key={`${row.ticker}-delta`} className="flex items-center justify-between text-sm">
                  <p className="font-medium text-foreground">
                    {row.companyName} ({row.ticker})
                  </p>
                  <p className="text-muted-foreground">
                    YoY delta: {row.yoyDelta === null ? 'N/D' : `${row.yoyDelta > 0 ? '+' : ''}${row.yoyDelta.toFixed(1)}B`}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
