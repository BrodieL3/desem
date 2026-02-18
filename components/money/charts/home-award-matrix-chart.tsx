'use client'

import Link from 'next/link'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {AwardMatrixData, AwardMatrixPoint} from '@/lib/data/signals/usaspending-server'

const DOT_COLOR_AWARD = '#7c3aed'
const Y_AXIS_WIDTH = 62
const CHART_HEIGHT = 320
const SVG_MARGIN_TOP = 8
const SVG_MARGIN_RIGHT = 16
const SVG_MARGIN_BOTTOM = 24
const DOT_RADIUS = 4
const HIT_RADIUS_SQ = 14 * 14

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

function formatFullDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'})
}

type ChartPoint = AwardMatrixPoint & {actionTimestamp: number}

function generateLogTicks(min: number, max: number): number[] {
  const ticks: number[] = []
  const logMin = Math.floor(Math.log10(Math.max(1, min)))
  const logMax = Math.ceil(Math.log10(max))
  for (let exp = logMin; exp <= logMax; exp++) {
    for (const mult of [1, 3]) {
      const val = mult * 10 ** exp
      if (val >= min && val <= max) ticks.push(val)
    }
  }
  return ticks
}

function generateMonthTicks(startTs: number, endTs: number): number[] {
  const ticks: number[] = []
  const d = new Date(startTs)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + 1)
  while (d.getTime() <= endTs) {
    ticks.push(d.getTime())
    d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return ticks
}

type HomeAwardMatrixChartProps = {
  data: AwardMatrixData
}

export function HomeAwardMatrixChart({data}: HomeAwardMatrixChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [hover, setHover] = useState<{point: ChartPoint; clientX: number; clientY: number} | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  // Y bounds using loop
  const Y_FLOOR = 10_000_000
  let rawMin = Infinity
  let rawMax = -Infinity
  for (const p of chartPoints) {
    if (p.amount < rawMin) rawMin = p.amount
    if (p.amount > rawMax) rawMax = p.amount
  }
  if (!isFinite(rawMin)) rawMin = Y_FLOOR
  if (!isFinite(rawMax)) rawMax = 1_000_000_000
  const yMin = Math.min(rawMin / 3, Y_FLOOR)
  const yMax = rawMax

  const {stats} = data

  const svgWidth = containerWidth || 400
  const plotWidth = svgWidth - Y_AXIS_WIDTH - SVG_MARGIN_RIGHT
  const plotTop = SVG_MARGIN_TOP
  const plotBottom = CHART_HEIGHT - SVG_MARGIN_BOTTOM
  const plotHeight = plotBottom - plotTop

  const logYMin = Math.log10(yMin)
  const logYRange = Math.log10(yMax) - logYMin
  const xRange = domainEnd - domainStart

  function toX(ts: number) {
    return Y_AXIS_WIDTH + (xRange > 0 ? ((ts - domainStart) / xRange) * plotWidth : 0)
  }
  function toY(amount: number) {
    if (logYRange <= 0) return plotTop + plotHeight / 2
    return plotBottom - ((Math.log10(amount) - logYMin) / logYRange) * plotHeight
  }

  const yTicks = generateLogTicks(yMin, yMax)
  const xTicks = generateMonthTicks(domainStart, domainEnd)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    let closest: ChartPoint | null = null
    let bestDist = HIT_RADIUS_SQ

    for (const p of chartPoints) {
      const cx = toX(p.actionTimestamp)
      const cy = toY(p.amount)
      const dx = mx - cx
      const dy = my - cy
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        closest = p
      }
    }

    if (closest) {
      setHover({point: closest, clientX: e.clientX, clientY: e.clientY})
    } else {
      setHover(null)
    }
  }

  function handleMouseLeave() {
    setHover(null)
  }

  function handleClick() {
    if (hover?.point.sourceUrl) window.open(hover.point.sourceUrl, '_blank')
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
        <div ref={containerRef} className="w-full min-w-0" style={{height: CHART_HEIGHT}}>
          {containerWidth > 0 && (
            <svg
              width={svgWidth}
              height={CHART_HEIGHT}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
              style={{cursor: hover ? 'pointer' : undefined}}
            >
              {/* Y-axis ticks */}
              {yTicks.map((tick) => {
                const y = toY(tick)
                return (
                  <g key={`yt${tick}`}>
                    <line x1={Y_AXIS_WIDTH - 4} y1={y} x2={Y_AXIS_WIDTH} y2={y} stroke="var(--muted-foreground)" strokeWidth={1} />
                    <text x={Y_AXIS_WIDTH - 8} y={y} textAnchor="end" dominantBaseline="central" fill="var(--muted-foreground)" fontSize={11}>
                      {formatAxisDollars(tick)}
                    </text>
                  </g>
                )
              })}
              {/* Horizontal grid lines */}
              {yTicks.map((tick) => {
                const y = toY(tick)
                return <line key={`yg${tick}`} x1={Y_AXIS_WIDTH} y1={y} x2={svgWidth - SVG_MARGIN_RIGHT} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
              })}
              {/* Vertical grid lines + X tick labels */}
              {xTicks.map((ts) => {
                const x = toX(ts)
                return (
                  <g key={`xg${ts}`}>
                    <line x1={x} y1={plotTop} x2={x} y2={plotBottom} stroke="var(--border)" strokeDasharray="3 3" />
                    <text x={x} y={plotBottom + 16} textAnchor="middle" fill="var(--muted-foreground)" fontSize={11}>
                      {formatDateTick(ts)}
                    </text>
                  </g>
                )
              })}
              {/* Data points */}
              {chartPoints.map((p) => (
                <circle
                  key={p.id}
                  cx={toX(p.actionTimestamp)}
                  cy={toY(p.amount)}
                  r={DOT_RADIUS}
                  fill={DOT_COLOR_AWARD}
                  opacity={0.7}
                />
              ))}
              {/* Hover highlight ring */}
              {hover && (
                <circle
                  cx={toX(hover.point.actionTimestamp)}
                  cy={toY(hover.point.amount)}
                  r={DOT_RADIUS + 2}
                  fill="none"
                  stroke={DOT_COLOR_AWARD}
                  strokeWidth={2}
                />
              )}
            </svg>
          )}
        </div>

        {/* Tooltip (fixed position) */}
        {hover && (
          <div
            className="fixed z-50 pointer-events-none w-64 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md"
            style={{left: hover.clientX + 12, top: hover.clientY + 12}}
          >
            <p className="font-medium">{truncate(hover.point.title, 80)}</p>
            <p className="text-xs text-muted-foreground">{hover.point.recipient}</p>
            {hover.point.subAgency && <p className="text-xs text-muted-foreground">{hover.point.subAgency}</p>}
            <div className="mt-1 space-y-0.5 text-xs">
              <p>{formatCurrency(hover.point.amount)} total obligation</p>
              <p>{hover.point.bucketLabel} &middot; {formatFullDate(hover.point.actionDate)}</p>
            </div>
          </div>
        )}

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
