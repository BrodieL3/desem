'use client'

import Link from 'next/link'
import {ScatterChart, CartesianGrid, XAxis, YAxis, ZAxis, Scatter, Tooltip, ResponsiveContainer} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {AwardMatrixData, AwardMatrixPoint} from '@/lib/data/signals/usaspending-server'

const DOT_COLOR_AWARD = '#7c3aed'
const DOT_COLOR_MODIFICATION = '#a1a1aa'

function formatAxisDollars(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function formatCurrency(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function dateToTimestamp(date: string) {
  return new Date(`${date}T00:00:00Z`).getTime()
}

function formatDateTick(timestamp: number) {
  const d = new Date(timestamp)
  return d.toLocaleDateString('en-US', {month: 'short', year: '2-digit', timeZone: 'UTC'})
}

function formatMonthYear(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString('en-US', {month: 'short', year: 'numeric', timeZone: 'UTC'})
}

type ChartPoint = AwardMatrixPoint & {actionTimestamp: number}

type TooltipPayloadEntry = {payload?: ChartPoint}

function CustomTooltip({active, payload}: {active?: boolean; payload?: TooltipPayloadEntry[]}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload
  if (!point) return null

  const dateLabel = new Date(`${point.actionDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <div className="w-64 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{truncate(point.title, 80)}</p>
      <p className="text-xs text-muted-foreground">{point.recipient}</p>
      {point.subAgency ? <p className="text-xs text-muted-foreground">{point.subAgency}</p> : null}
      <div className="mt-1 space-y-0.5 text-xs">
        <p>{formatCurrency(point.amount)} total obligation</p>
        <p>{point.bucketLabel} &middot; {dateLabel}</p>
      </div>
    </div>
  )
}

type HomeAwardMatrixChartProps = {
  data: AwardMatrixData
}

export function HomeAwardMatrixChart({data}: HomeAwardMatrixChartProps) {
  if (data.insufficientData || data.points.length === 0) {
    return null
  }

  const now = new Date()
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6)
  const domainStart = dateToTimestamp(sixMonthsAgo.toISOString().slice(0, 10))
  const domainEnd = dateToTimestamp(now.toISOString().slice(0, 10))

  const chartPoints: ChartPoint[] = data.points
    .map((p) => ({...p, actionTimestamp: dateToTimestamp(p.actionDate)}))
    .filter((p) => p.actionTimestamp >= domainStart && p.actionTimestamp <= domainEnd)

  if (chartPoints.length === 0) return null

  const amounts = chartPoints.map((p) => p.amount)
  const Y_FLOOR = 10_000_000
  const rawMin = Math.min(...amounts)
  const yMin = Math.min(rawMin / 3, Y_FLOOR)
  const yMax = Math.max(...amounts)

  const {stats} = data
  const topRecipient = stats.topRecipients[0]

  function handleClick(point: ChartPoint) {
    if (point.sourceUrl) window.open(point.sourceUrl, '_blank')
  }

  return (
    <Card className="min-w-0 rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.45rem] leading-tight">
          <Link href="/awards" className="hover:text-primary transition-colors">
            Award matrix
          </Link>
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Last 6 months &middot; {stats.totalAwardCount.toLocaleString()} award{stats.totalAwardCount !== 1 ? 's' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-[320px] w-full min-w-0 [&_svg]:!outline-none [&_svg]:!ring-0 [&_*]:!outline-none [&_*]:!ring-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ScatterChart margin={{top: 8, right: 16, left: 0, bottom: 24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="actionTimestamp"
                name="Date"
                type="number"
                domain={[domainStart, domainEnd]}
                tick={{fill: 'var(--muted-foreground)', fontSize: 11}}
                tickFormatter={formatDateTick}
              />
              <YAxis
                dataKey="amount"
                name="Award value"
                tick={{fill: 'var(--muted-foreground)', fontSize: 11}}
                tickFormatter={formatAxisDollars}
                width={62}
                scale="log"
                domain={[yMin, yMax]}
              />
              <ZAxis range={[30, 90]} />
              <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
              <Scatter
                name="Awards"
                data={chartPoints}
                fill={DOT_COLOR_AWARD}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(_data, _index, event) => {
                  const target = event as unknown as {payload?: ChartPoint}
                  if (target.payload) handleClick(target.payload)
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-muted-foreground">
          Source: USAspending.gov &middot;{' '}
          <Link href="/awards" className="text-primary underline-offset-4 hover:underline">
            Full interactive view
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
