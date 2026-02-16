'use client'

import {memo, useMemo} from 'react'
import type {ReactNode} from 'react'
import {CartesianGrid, Label, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'

import type {PrimeMetricChartCardProps} from './types'

type ChartRow = {
  periodLabel: string
  periodEnd: string
  [ticker: string]: number | string | null
}

type TooltipValue = number | string | ReadonlyArray<string | number> | null | undefined

function defaultFormatter(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return 'Not disclosed'
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })
}

function buildChartRows(points: PrimeMetricChartCardProps['points']) {
  const byPeriod = new Map<string, ChartRow>()

  for (const point of points) {
    const key = `${point.periodEnd}-${point.periodLabel}`
    const existing = byPeriod.get(key) ?? {
      periodLabel: point.periodLabel,
      periodEnd: point.periodEnd,
    }

    existing[point.ticker] = point.value
    byPeriod.set(key, existing)
  }

  return [...byPeriod.values()].sort((left, right) => Date.parse(String(left.periodEnd)) - Date.parse(String(right.periodEnd)))
}

function tooltipLabel(label: ReactNode, _payload?: ReadonlyArray<unknown>) {
  if (Array.isArray(label)) {
    return String(label[0] ?? '')
  }

  if (typeof label === 'string' || typeof label === 'number') {
    return String(label)
  }

  return ''
}

function formatTooltipValue(value: TooltipValue) {
  if (value === null || typeof value === 'undefined') {
    return 'Not disclosed'
  }

  if (Array.isArray(value)) {
    const first = value[0]

    if (typeof first === 'number') {
      return defaultFormatter(first)
    }

    return String(first)
  }

  if (typeof value === 'number') {
    return defaultFormatter(value)
  }

  return value
}

function MetricChartCardComponent({
  title,
  description,
  companies,
  points,
  formatter = defaultFormatter,
  yReference,
  yReferenceLabel,
  emptyLabel = 'No data available for this metric yet.',
}: PrimeMetricChartCardProps) {
  const rows = useMemo(() => buildChartRows(points), [points])

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.65rem] leading-tight">{title}</CardTitle>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyLabel}</p>
        ) : (
          <div className="h-[320px] w-full" role="img" aria-label={title}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{top: 16, right: 12, left: 0, bottom: 8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="periodLabel" tick={{fill: 'var(--muted-foreground)', fontSize: 12}} interval="preserveStartEnd" />
                <YAxis tick={{fill: 'var(--muted-foreground)', fontSize: 12}} width={58} tickFormatter={(value) => formatter(value)} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.6rem',
                    fontSize: '0.85rem',
                  }}
                  labelStyle={{color: 'var(--foreground)'}}
                  formatter={(value) => [formatTooltipValue(value), '']}
                  labelFormatter={tooltipLabel}
                />
                <Legend wrapperStyle={{fontSize: '0.78rem'}} />
                {typeof yReference === 'number' ? (
                  <ReferenceLine y={yReference} stroke="var(--muted-foreground)" strokeDasharray="4 4">
                    {yReferenceLabel ? (
                      <Label
                        value={yReferenceLabel}
                        position="insideTopRight"
                        fill="var(--muted-foreground)"
                        fontSize={11}
                      />
                    ) : null}
                  </ReferenceLine>
                ) : null}
                {companies.map((company) => (
                  <Line
                    key={company.ticker}
                    type="monotone"
                    dataKey={company.ticker}
                    name={company.ticker}
                    connectNulls={false}
                    stroke={`var(--${company.colorToken})`}
                    strokeWidth={2}
                    dot={{r: 2}}
                    activeDot={{r: 4}}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const MetricChartCard = memo(MetricChartCardComponent)
