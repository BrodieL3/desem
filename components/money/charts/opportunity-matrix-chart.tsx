'use client'

import {ResponsiveContainer, ScatterChart, CartesianGrid, XAxis, YAxis, ZAxis, Scatter, Tooltip} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {defenseMoneyBucketColorMap, defenseMoneyBucketLabelMap} from '@/lib/data/signals/chart-colors'
import type {OpportunityMatrixData, OpportunityMatrixPoint} from '@/lib/data/signals/sam-gov-server'
import type {DefenseMoneyBucket} from '@/lib/data/signals/types'

type OpportunityMatrixChartProps = {
  data: OpportunityMatrixData
}

function formatAxisDollars(value: number) {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)}M`
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }

  return `$${value.toFixed(0)}`
}

function formatCurrency(value: number) {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }

  return `$${value.toFixed(0)}`
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}...` : text
}

type TooltipPayloadEntry = {
  payload?: OpportunityMatrixPoint
}

function CustomTooltip({active, payload}: {active?: boolean; payload?: TooltipPayloadEntry[]}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload
  if (!point) return null

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{truncate(point.title, 80)}</p>
      <p className="text-xs text-muted-foreground">{point.department ?? 'DoD'}</p>
      <div className="mt-1 space-y-0.5 text-xs">
        {point.estimatedValue ? <p>Value: {formatCurrency(point.estimatedValue)}</p> : null}
        <p>Deadline: {point.daysUntilDeadline} days</p>
        <p>Category: {point.bucketLabel}</p>
      </div>
    </div>
  )
}

export function OpportunityMatrixChart({data}: OpportunityMatrixChartProps) {
  if (data.points.length === 0) {
    return (
      <Card className="rounded-lg border border-border bg-card">
        <CardHeader className="space-y-1">
          <CardTitle className="font-display text-[1.45rem] leading-tight">Opportunity matrix</CardTitle>
          <p className="text-muted-foreground text-sm">Active solicitations by value, timeline, and category.</p>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No active solicitations found.</p>
        </CardContent>
      </Card>
    )
  }

  // Group points by bucket for legend
  const bucketGroups = new Map<string, OpportunityMatrixPoint[]>()

  for (const point of data.points) {
    const key = point.bucket ?? 'uncategorized'
    const group = bucketGroups.get(key) ?? []
    group.push(point)
    bucketGroups.set(key, group)
  }

  function handleClick(point: OpportunityMatrixPoint) {
    if (point.sourceUrl) {
      window.open(point.sourceUrl, '_blank')
    }
  }

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.45rem] leading-tight">Opportunity matrix</CardTitle>
        <p className="text-muted-foreground text-sm">Active solicitations by value, timeline, and category.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {data.solicitationCount} active solicitation{data.solicitationCount !== 1 ? 's' : ''}
          {' \u00B7 '}
          {data.presolicitationCount} pre-solicitation{data.presolicitationCount !== 1 ? 's' : ''}
          {' \u00B7 '}
          {formatCurrency(data.totalEstimatedValue)} est. value
        </p>

        <div className="h-[360px] w-full" role="img" aria-label="Opportunity matrix scatter chart">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{top: 8, right: 10, left: 0, bottom: 0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="daysUntilDeadline"
                name="Days until deadline"
                tick={{fill: 'var(--muted-foreground)', fontSize: 11}}
                label={{value: 'Days until deadline', position: 'insideBottom', offset: -4, fill: 'var(--muted-foreground)', fontSize: 11}}
              />
              <YAxis
                dataKey="estimatedValue"
                name="Estimated value"
                tick={{fill: 'var(--muted-foreground)', fontSize: 11}}
                tickFormatter={formatAxisDollars}
                width={58}
              />
              <ZAxis dataKey="competitionLevel" range={[40, 400]} name="Competition" />
              <Tooltip content={<CustomTooltip />} />
              {[...bucketGroups.entries()].map(([bucketKey, points]) => {
                const colorToken = bucketKey !== 'uncategorized'
                  ? defenseMoneyBucketColorMap[bucketKey as DefenseMoneyBucket]
                  : 'chart-1'
                const label = bucketKey !== 'uncategorized'
                  ? defenseMoneyBucketLabelMap[bucketKey as DefenseMoneyBucket]
                  : 'Uncategorized'

                return (
                  <Scatter
                    key={bucketKey}
                    name={label}
                    data={points}
                    fill={`var(--${colorToken})`}
                    isAnimationActive={false}
                    cursor="pointer"
                    onClick={(_data, _index, event) => {
                      // The scatter click gives us the data point
                      const target = event as unknown as {payload?: OpportunityMatrixPoint}
                      if (target.payload) handleClick(target.payload)
                    }}
                  />
                )
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
