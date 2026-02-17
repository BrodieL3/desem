'use client'

import Link from 'next/link'
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import type {GprLevel, GprSummary} from '@/lib/data/signals/gpr-server'

type MacroRiskCardProps = {
  summary: GprSummary
}

const levelConfig: Record<GprLevel, {label: string; className: string}> = {
  low: {label: 'Low', className: 'bg-success/15 text-success-foreground'},
  elevated: {label: 'Elevated', className: 'bg-warning/15 text-warning-foreground'},
  high: {label: 'High', className: 'bg-destructive/15 text-destructive'},
}

function formatDelta(delta: number) {
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)} vs prior month`
}

export function MacroRiskCard({summary}: MacroRiskCardProps) {
  if (!summary.latest) {
    return (
      <article className="news-divider-item px-1">
        <p className="text-muted-foreground text-xs tracking-[0.12em] uppercase">Geopolitical Risk</p>
        <p className="text-muted-foreground mt-2 text-sm">Geopolitical risk data is being loaded.</p>
      </article>
    )
  }

  const config = levelConfig[summary.level]

  return (
    <article className="news-divider-item px-1">
      <div className="flex items-center gap-2">
        <p className="text-muted-foreground text-xs tracking-[0.12em] uppercase">Geopolitical Risk</p>
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${config.className}`}>
          {config.label}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-3">
        <p className="text-foreground text-[1.6rem] font-semibold leading-tight">{summary.latest.gpr.toFixed(1)}</p>
        {summary.delta !== null ? (
          <p className={`text-sm ${summary.delta >= 0 ? 'text-warning-foreground' : 'text-success-foreground'}`}>
            {formatDelta(summary.delta)}
          </p>
        ) : null}
      </div>

      {summary.sparkline.length >= 2 ? (
        <div className="mt-3 h-[64px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={summary.sparkline} margin={{top: 4, right: 2, left: 2, bottom: 0}}>
              <XAxis dataKey="periodDate" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.6rem',
                  fontSize: '0.8rem',
                }}
                formatter={(value) => [Number(value).toFixed(1), 'GPR']}
                labelFormatter={(label) => String(label)}
              />
              <Line
                type="monotone"
                dataKey="gpr"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <p className="text-muted-foreground mt-2 text-xs">
        <Link
          href="https://www.matteoiacoviello.com/gpr.htm"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
        >
          Caldara &amp; Iacoviello GPR Index
        </Link>
        {' · '}Monthly, newspaper-based geopolitical risk measure
      </p>
    </article>
  )
}
