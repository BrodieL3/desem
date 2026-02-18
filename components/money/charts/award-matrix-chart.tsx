'use client'

import Link from 'next/link'
import {useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState} from 'react'
import {AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'

import type {AwardAmounts, AwardMatrixData, AwardMatrixPoint, AwardMilestones, AwardTransactionHistory} from '@/lib/data/signals/usaspending-server'

const DOT_COLOR_AWARD = '#7c3aed'

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

function formatFullDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'})
}

/** Shift an ISO date string by N months */
function shiftMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

// --- Chart constants ---
const PX_PER_MONTH = 120
const Y_AXIS_WIDTH = 62
const CHART_HEIGHT = 420
const SCROLL_THRESHOLD = 200
const FETCH_WINDOW_MONTHS = 6
const INITIAL_WINDOW_MONTHS = 18
const LEFT_FLOOR = '2025-01-01'
const MAX_EMPTY_FETCHES = 3
const SEARCH_DEBOUNCE_MS = 150
const SEARCH_RESULTS_LIMIT = 50
const MAX_POINTS = 2000

// SVG scatter layout
const SVG_MARGIN_TOP = 8
const SVG_MARGIN_RIGHT = 16
const SVG_MARGIN_BOTTOM = 24
const DOT_RADIUS = 5
const HIT_RADIUS_SQ = 15 * 15

type SortOrder = 'price-desc' | 'price-asc' | 'newest'

// --- State management ---
type State = {
  points: Map<string, AwardMatrixPoint>
  rangeStart: string
  rangeEnd: string
  loadingLeft: boolean
  loadingRight: boolean
  hasMoreLeft: boolean
  hasMoreRight: boolean
  initialLoading: boolean
  error: boolean
  emptyLeftCount: number
  emptyRightCount: number
  prevScrollWidth: number | null
}

type Action =
  | {type: 'INITIAL_SUCCESS'; payload: AwardMatrixData}
  | {type: 'INITIAL_ERROR'}
  | {type: 'FETCH_LEFT_START'; prevScrollWidth: number}
  | {type: 'FETCH_LEFT_SUCCESS'; payload: AwardMatrixData}
  | {type: 'FETCH_LEFT_ERROR'}
  | {type: 'FETCH_RIGHT_START'}
  | {type: 'FETCH_RIGHT_SUCCESS'; payload: AwardMatrixData}
  | {type: 'FETCH_RIGHT_ERROR'}

function mergePoints(existing: Map<string, AwardMatrixPoint>, incoming: AwardMatrixPoint[]) {
  const merged = new Map(existing)
  for (const p of incoming) {
    merged.set(p.id, p)
  }
  if (merged.size > MAX_POINTS) {
    const sorted = [...merged.values()].sort((a, b) => a.actionDate.localeCompare(b.actionDate))
    const excess = merged.size - MAX_POINTS
    for (let i = 0; i < excess; i++) {
      merged.delete(sorted[i].id)
    }
  }
  return merged
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INITIAL_SUCCESS': {
      const points = new Map<string, AwardMatrixPoint>()
      for (const p of action.payload.points) points.set(p.id, p)
      return {
        ...state,
        points,
        rangeStart: action.payload.startDate,
        rangeEnd: action.payload.endDate,
        initialLoading: false,
        hasMoreLeft: action.payload.startDate > LEFT_FLOOR,
        hasMoreRight: false,
      }
    }
    case 'INITIAL_ERROR':
      return {...state, initialLoading: false, error: true}

    case 'FETCH_LEFT_START':
      return {...state, loadingLeft: true, prevScrollWidth: action.prevScrollWidth}
    case 'FETCH_LEFT_SUCCESS': {
      const newEmpty = action.payload.points.length === 0 ? state.emptyLeftCount + 1 : 0
      return {
        ...state,
        points: mergePoints(state.points, action.payload.points),
        rangeStart: action.payload.startDate,
        loadingLeft: false,
        emptyLeftCount: newEmpty,
        hasMoreLeft: newEmpty < MAX_EMPTY_FETCHES && action.payload.startDate > LEFT_FLOOR,
      }
    }
    case 'FETCH_LEFT_ERROR':
      return {...state, loadingLeft: false, prevScrollWidth: null}

    case 'FETCH_RIGHT_START':
      return {...state, loadingRight: true}
    case 'FETCH_RIGHT_SUCCESS': {
      const newEmpty = action.payload.points.length === 0 ? state.emptyRightCount + 1 : 0
      const today = todayIso()
      return {
        ...state,
        points: mergePoints(state.points, action.payload.points),
        rangeEnd: action.payload.endDate > today ? today : action.payload.endDate,
        loadingRight: false,
        emptyRightCount: newEmpty,
        hasMoreRight: newEmpty < MAX_EMPTY_FETCHES && action.payload.endDate < today,
      }
    }
    case 'FETCH_RIGHT_ERROR':
      return {...state, loadingRight: false}

    default:
      return state
  }
}

function initialState(): State {
  return {
    points: new Map(),
    rangeStart: '',
    rangeEnd: '',
    loadingLeft: false,
    loadingRight: false,
    hasMoreLeft: true,
    hasMoreRight: false,
    initialLoading: true,
    error: false,
    emptyLeftCount: 0,
    emptyRightCount: 0,
    prevScrollWidth: null,
  }
}

// --- Fetch helper ---
async function fetchRange(startDate: string, endDate: string, signal?: AbortSignal): Promise<AwardMatrixData | null> {
  const params = new URLSearchParams({startDate, endDate})
  const res = await fetch(`/api/data/signals/awards?${params}`, {signal})
  if (!res.ok) return null
  const json = await res.json()
  return json.data as AwardMatrixData
}

type ChartPoint = AwardMatrixPoint & {actionTimestamp: number}

// --- SVG helpers ---
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

// --- Contract search results ---
function ContractResultRow({point}: {point: AwardMatrixPoint}) {
  return (
    <div className="news-divider-item flex items-start justify-between gap-3 px-1 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs text-muted-foreground">{point.bucketLabel}</span>
          <span className="text-xs text-muted-foreground">&middot;</span>
          <span className="text-xs text-muted-foreground">{formatFullDate(point.actionDate)}</span>
        </div>
        <Link
          href={point.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          {truncate(point.title, 120)}
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5">
          {point.recipient}
          {point.subAgency ? ` \u00B7 ${point.subAgency}` : ''}
        </p>
      </div>
      <p className="flex-none text-sm font-medium tabular-nums">{formatCurrency(point.amount)}</p>
    </div>
  )
}

const SORT_OPTIONS: {value: SortOrder; label: string}[] = [
  {value: 'price-desc', label: 'Highest value'},
  {value: 'price-asc', label: 'Lowest value'},
  {value: 'newest', label: 'Newest'},
]

function ContractSearchPanel({
  allPoints,
}: {
  allPoints: AwardMatrixPoint[]
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('price-desc')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const results = useMemo(() => {
    if (!debouncedQuery) return []

    const matched = allPoints.filter((p) => {
      const haystack = `${p.title} ${p.recipient} ${p.subAgency ?? ''} ${p.bucketLabel}`.toLowerCase()
      return haystack.includes(debouncedQuery)
    })

    matched.sort((a, b) => {
      if (sortOrder === 'price-desc') return b.amount - a.amount
      if (sortOrder === 'price-asc') return a.amount - b.amount
      return b.actionDate.localeCompare(a.actionDate)
    })

    return matched.slice(0, SEARCH_RESULTS_LIMIT)
  }, [allPoints, debouncedQuery, sortOrder])

  const hasQuery = debouncedQuery.length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search awards by recipient, agency, or description..."
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/80 focus-visible:ring-2 focus-visible:ring-foreground/25"
        />
      </div>

      {hasQuery && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {results.length >= SEARCH_RESULTS_LIMIT ? `${SEARCH_RESULTS_LIMIT}+` : results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSortOrder(opt.value)}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  sortOrder === opt.value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasQuery && results.length > 0 && (
        <div className="news-divider-list news-divider-list-no-top max-h-[400px] overflow-y-auto">
          {results.map((point) => (
            <ContractResultRow key={point.id} point={point} />
          ))}
        </div>
      )}

      {hasQuery && results.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No awards match your search.</p>
      )}
    </div>
  )
}

// --- Chart content ---
const SENTINEL_WIDTH = 300
const VIEWPORT_DEBOUNCE_MS = 150
const VIEWPORT_BUFFER_PX = PX_PER_MONTH * 2

function AwardMatrixChartContent({
  points,
  rangeStart,
  rangeEnd,
  loadingLeft,
  loadingRight,
  hasMoreLeft,
  hasMoreRight,
  onScrollRef,
  onSelectAward,
}: {
  points: AwardMatrixPoint[]
  rangeStart: string
  rangeEnd: string
  loadingLeft: boolean
  loadingRight: boolean
  hasMoreLeft: boolean
  hasMoreRight: boolean
  onScrollRef: (el: HTMLDivElement | null) => void
  onSelectAward: (point: AwardMatrixPoint) => void
}) {
  const localScrollRef = useRef<HTMLDivElement | null>(null)
  const [viewportTs, setViewportTs] = useState<[number, number] | null>(null)
  const [hover, setHover] = useState<{point: ChartPoint; clientX: number; clientY: number} | null>(null)

  const setScrollEl = useCallback((el: HTMLDivElement | null) => {
    localScrollRef.current = el
    onScrollRef(el)
  }, [onScrollRef])

  const chartPoints = useMemo<ChartPoint[]>(
    () => points.map((p) => ({...p, actionTimestamp: dateToTimestamp(p.actionDate)})),
    [points],
  )

  const rangeStartTs = dateToTimestamp(rangeStart)
  const rangeEndTs = dateToTimestamp(rangeEnd)
  const spanMonths = Math.max(1, (rangeEndTs - rangeStartTs) / (30 * 24 * 60 * 60 * 1000))
  const chartWidth = Math.max(800, Math.round(spanMonths * PX_PER_MONTH))
  const plotWidth = chartWidth - SVG_MARGIN_RIGHT
  const plotTop = SVG_MARGIN_TOP
  const plotBottom = CHART_HEIGHT - SVG_MARGIN_BOTTOM
  const plotHeight = plotBottom - plotTop

  // Y-axis bounds from ALL points (loop avoids call-stack overflow with spread)
  const {yMin, yMax} = useMemo(() => {
    const Y_FLOOR = 10_000_000
    let min = Infinity
    let max = -Infinity
    for (const p of chartPoints) {
      if (p.amount < min) min = p.amount
      if (p.amount > max) max = p.amount
    }
    if (!isFinite(min)) min = Y_FLOOR
    if (!isFinite(max)) max = 1_000_000_000
    return {yMin: Math.min(min / 3, Y_FLOOR), yMax: max}
  }, [chartPoints])

  const logYMin = Math.log10(yMin)
  const logYRange = Math.log10(yMax) - logYMin
  const xRange = rangeEndTs - rangeStartTs

  function toX(ts: number) {
    return xRange > 0 ? ((ts - rangeStartTs) / xRange) * plotWidth : 0
  }
  function toY(amount: number) {
    if (logYRange <= 0) return plotTop + plotHeight / 2
    return plotBottom - ((Math.log10(amount) - logYMin) / logYRange) * plotHeight
  }

  // --- Viewport culling ---
  useEffect(() => {
    const el = localScrollRef.current
    if (!el || chartWidth <= 0) return

    let timerId: ReturnType<typeof setTimeout>

    function compute() {
      const scrollEl = localScrollRef.current
      if (!scrollEl) return

      const sentinelW = hasMoreLeft ? SENTINEL_WIDTH : 0
      const scrollPos = scrollEl.scrollLeft - sentinelW
      const viewW = scrollEl.clientWidth
      const span = rangeEndTs - rangeStartTs
      if (span <= 0) return

      const startPx = Math.max(0, scrollPos - VIEWPORT_BUFFER_PX)
      const endPx = Math.min(chartWidth, scrollPos + viewW + VIEWPORT_BUFFER_PX)

      const start = rangeStartTs + (startPx / chartWidth) * span
      const end = rangeStartTs + (endPx / chartWidth) * span

      setViewportTs([start, end])
    }

    function onScroll() {
      clearTimeout(timerId)
      timerId = setTimeout(compute, VIEWPORT_DEBOUNCE_MS)
    }

    el.addEventListener('scroll', onScroll, {passive: true})
    compute()

    return () => {
      el.removeEventListener('scroll', onScroll)
      clearTimeout(timerId)
    }
  }, [chartWidth, rangeStartTs, rangeEndTs, hasMoreLeft])

  const visiblePoints = useMemo(
    () => viewportTs
      ? chartPoints.filter((p) => p.actionTimestamp >= viewportTs[0] && p.actionTimestamp <= viewportTs[1])
      : chartPoints,
    [chartPoints, viewportTs],
  )

  const yTicks = useMemo(() => generateLogTicks(yMin, yMax), [yMin, yMax])
  const xTicks = useMemo(() => generateMonthTicks(rangeStartTs, rangeEndTs), [rangeStartTs, rangeEndTs])

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    let closest: ChartPoint | null = null
    let bestDist = HIT_RADIUS_SQ

    for (const p of visiblePoints) {
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
    if (hover) onSelectAward(hover.point)
  }

  return (
    <>
      <div
        className="relative overflow-hidden"
        role="img"
        aria-label="Award matrix scatter chart"
      >
        {/* Pinned Y-axis overlay */}
        <div
          className="pointer-events-none absolute left-0 top-0 z-10 bg-card"
          style={{width: Y_AXIS_WIDTH, height: CHART_HEIGHT}}
        >
          <svg width={Y_AXIS_WIDTH} height={CHART_HEIGHT}>
            {yTicks.map((tick) => {
              const y = toY(tick)
              return (
                <g key={tick}>
                  <line x1={Y_AXIS_WIDTH - 4} y1={y} x2={Y_AXIS_WIDTH} y2={y} stroke="var(--muted-foreground)" strokeWidth={1} />
                  <text x={Y_AXIS_WIDTH - 8} y={y} textAnchor="end" dominantBaseline="central" fill="var(--muted-foreground)" fontSize={11}>
                    {formatAxisDollars(tick)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Scrollable chart area */}
        <div
          ref={setScrollEl}
          className="overflow-x-auto"
          style={{paddingLeft: Y_AXIS_WIDTH}}
        >
          {loadingLeft && (
            <div className="absolute left-0 top-0 z-20 h-full w-1 animate-pulse bg-primary/40" style={{marginLeft: Y_AXIS_WIDTH}} />
          )}

          <div className="flex" style={{height: CHART_HEIGHT}}>
            {hasMoreLeft && (
              <div className="flex-none flex items-center justify-center" style={{width: SENTINEL_WIDTH}}>
                {loadingLeft && <p className="text-xs text-muted-foreground animate-pulse">Loading&hellip;</p>}
              </div>
            )}

            <div className="flex-none" style={{width: chartWidth, height: CHART_HEIGHT}}>
              <svg
                width={chartWidth}
                height={CHART_HEIGHT}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                style={{cursor: hover ? 'pointer' : undefined}}
              >
                {/* Horizontal grid lines */}
                {yTicks.map((tick) => {
                  const y = toY(tick)
                  return <line key={`yg${tick}`} x1={0} y1={y} x2={plotWidth} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
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
                {visiblePoints.map((p) => (
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
            </div>

            {hasMoreRight && (
              <div className="flex-none flex items-center justify-center" style={{width: SENTINEL_WIDTH}}>
                {loadingRight && <p className="text-xs text-muted-foreground animate-pulse">Loading&hellip;</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tooltip (fixed position, outside overflow context) */}
      {hover && (
        <div
          className="fixed z-50 pointer-events-none w-64 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md"
          style={{left: hover.clientX + 12, top: hover.clientY + 12}}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{backgroundColor: DOT_COLOR_AWARD}} />
            <span className="text-xs font-medium text-muted-foreground">New award</span>
          </div>
          <p className="font-medium">{truncate(hover.point.title, 80)}</p>
          <p className="text-xs text-muted-foreground">{hover.point.recipient}</p>
          {hover.point.subAgency && <p className="text-xs text-muted-foreground">{hover.point.subAgency}</p>}
          <div className="mt-1 space-y-0.5 text-xs">
            <p>{formatCurrency(hover.point.amount)} total obligation</p>
            <p>{hover.point.bucketLabel} &middot; {formatFullDate(hover.point.actionDate)}</p>
          </div>
        </div>
      )}
    </>
  )
}

// --- Detail panel ---
type DetailTooltipEntry = {payload?: {date: string; amount: number}}

function DetailTooltip({active, payload}: {active?: boolean; payload?: DetailTooltipEntry[]}) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]?.payload
  if (!p) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs shadow-md">
      <p className="font-medium">{formatCurrency(p.amount)}</p>
      <p className="text-muted-foreground">{formatFullDate(p.date)}</p>
    </div>
  )
}

// --- Award Amounts bar ---

const AMOUNT_TIERS = [
  {key: 'outlayed', label: 'Outlayed', color: '#1b2a4a'},
  {key: 'obligated', label: 'Obligated', color: '#3b5998'},
  {key: 'current', label: 'Current Award', color: '#7c9fd4'},
  {key: 'potential', label: 'Potential Award', color: '#c8d6e8'},
] as const

function AwardAmountsBar({amounts}: {amounts: AwardAmounts}) {
  const maxValue = Math.max(
    amounts.potential ?? 0,
    amounts.current,
    amounts.obligated ?? 0,
    amounts.outlayed ?? 0,
  )
  if (maxValue <= 0) return null

  const tiers = AMOUNT_TIERS.map((t) => {
    const value = t.key === 'current' ? amounts.current : (amounts[t.key] ?? null)
    return {...t, value}
  }).filter((t) => t.value !== null && t.value > 0) as Array<{key: string; label: string; color: string; value: number}>

  if (tiers.length <= 1) return null

  // Sort widest (largest) first so the nested bars layer correctly
  const sorted = [...tiers].sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Award amounts</p>
      <div className="relative h-7 w-full rounded bg-muted/50">
        {sorted.map((tier) => {
          const pct = (tier.value / maxValue) * 100
          return (
            <div
              key={tier.key}
              className="absolute inset-y-0 left-0 rounded"
              style={{width: `${pct}%`, backgroundColor: tier.color}}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {tiers.map((tier) => (
          <div key={tier.key} className="flex items-center gap-1.5 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-sm flex-none" style={{backgroundColor: tier.color}} />
            <span className="text-muted-foreground">{tier.label}</span>
            <span className="font-medium tabular-nums">{formatCurrency(tier.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Contract Activity chart with milestone lines ---

const MILESTONE_COLORS = {
  start: '#22c55e',
  today: '#a1a1aa',
  currentEnd: '#eab308',
  potentialEnd: '#f87171',
} as const

type ActivityChartPoint = {
  date: string
  timestamp: number
  amount: number
  description: string
}

function ContractActivityChart({
  history,
  milestones,
  amounts,
}: {
  history: AwardTransactionHistory
  milestones: AwardMilestones
  amounts: AwardAmounts
}) {
  const today = new Date().toISOString().slice(0, 10)
  const toTs = (d: string) => new Date(`${d}T00:00:00Z`).getTime()

  const chartData: ActivityChartPoint[] = history.points.map((p) => ({
    date: p.date,
    timestamp: toTs(p.date),
    amount: p.amount,
    description: p.description,
  }))

  // Determine X domain: earliest of start/first point through latest of potentialEnd/last point
  const allDates = chartData.map((p) => p.date)
  if (milestones.startDate) allDates.push(milestones.startDate)
  if (milestones.potentialEndDate) allDates.push(milestones.potentialEndDate)
  if (milestones.currentEndDate) allDates.push(milestones.currentEndDate)
  allDates.push(today)

  const timestamps = allDates.map(toTs)
  const xMin = Math.min(...timestamps)
  const xMax = Math.max(...timestamps)

  // Y domain: up to potential amount if available, else max of points
  const maxAmount = Math.max(
    ...chartData.map((p) => p.amount),
    amounts.potential ?? 0,
    amounts.current,
  )
  const yMax = maxAmount * 1.1

  const milestoneLine = (date: string | null, label: string, color: string) => {
    if (!date) return null
    return (
      <ReferenceLine
        x={toTs(date)}
        stroke={color}
        strokeWidth={1.5}
        label={{
          value: label,
          position: 'top',
          fill: color,
          fontSize: 10,
          fontWeight: 500,
        }}
      />
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Contract activity</p>
      <div className="h-[220px] w-full [&_*]:!outline-none [&_*]:!ring-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{top: 20, right: 12, left: 0, bottom: 4}}>
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={[xMin, xMax]}
              tick={{fill: 'var(--muted-foreground)', fontSize: 10}}
              tickFormatter={(ts: number) => {
                const d = new Date(ts)
                return d.toLocaleDateString('en-US', {month: 'short', year: '2-digit', timeZone: 'UTC'})
              }}
            />
            <YAxis
              tick={{fill: 'var(--muted-foreground)', fontSize: 10}}
              tickFormatter={formatAxisDollars}
              width={54}
              domain={[0, yMax]}
            />
            <Tooltip
              content={<DetailTooltip />}
              isAnimationActive={false}
            />
            {/* Potential amount ceiling line */}
            {amounts.potential != null && amounts.potential > 0 && (
              <ReferenceLine
                y={amounts.potential}
                stroke="#c8d6e8"
                strokeDasharray="6 3"
                strokeWidth={1}
              />
            )}
            {/* Milestone vertical lines */}
            {milestoneLine(milestones.startDate, 'Start', MILESTONE_COLORS.start)}
            {milestoneLine(today, 'Today', MILESTONE_COLORS.today)}
            {milestoneLine(milestones.currentEndDate, 'Current End', MILESTONE_COLORS.currentEnd)}
            {milestoneLine(milestones.potentialEndDate, 'Potential End', MILESTONE_COLORS.potentialEnd)}
            <Area
              type="stepAfter"
              dataKey="amount"
              stroke={DOT_COLOR_AWARD}
              fill={DOT_COLOR_AWARD}
              fillOpacity={0.15}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// --- Award detail panel ---

function AwardDetailPanel({
  award,
  onClose,
}: {
  award: AwardMatrixPoint
  onClose: () => void
}) {
  const [history, setHistory] = useState<AwardTransactionHistory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const ac = new AbortController()
    const params = new URLSearchParams({awardId: award.id})

    fetch(`/api/data/signals/awards/history?${params}`, {signal: ac.signal})
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!ac.signal.aborted) {
          setHistory(json?.data ?? null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) setLoading(false)
      })

    return () => ac.abort()
  }, [award.id])

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{award.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {award.recipient}
            {award.subAgency ? ` \u00B7 ${award.subAgency}` : ''}
            {` \u00B7 ${award.bucketLabel}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-none rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close detail panel"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-xs text-muted-foreground animate-pulse">Loading history&hellip;</p>
        </div>
      ) : history && history.points.length > 0 ? (
        <div className="space-y-4">
          {/* Award Amounts nested bar */}
          <AwardAmountsBar amounts={history.amounts} />

          {/* Contract Activity timeline */}
          <ContractActivityChart
            history={history}
            milestones={history.milestones}
            amounts={history.amounts}
          />

          {/* Key stats */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Current value</p>
              <p className="font-medium tabular-nums">{formatCurrency(history.currentAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">First action</p>
              <p className="tabular-nums">{formatFullDate(history.points[0].date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Modifications</p>
              <p className="tabular-nums">{history.points.length}</p>
            </div>
            {history.milestones.startDate && (
              <div>
                <p className="text-xs text-muted-foreground">Start</p>
                <p className="tabular-nums">{formatFullDate(history.milestones.startDate)}</p>
              </div>
            )}
            {history.milestones.currentEndDate && (
              <div>
                <p className="text-xs text-muted-foreground">Current end</p>
                <p className="tabular-nums">{formatFullDate(history.milestones.currentEndDate)}</p>
              </div>
            )}
            {history.milestones.potentialEndDate && (
              <div>
                <p className="text-xs text-muted-foreground">Potential end</p>
                <p className="tabular-nums">{formatFullDate(history.milestones.potentialEndDate)}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No transaction history available.</p>
      )}

      <a
        href={award.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-4"
      >
        View on USAspending.gov &rarr;
      </a>
    </div>
  )
}

// --- Main component ---
export function AwardMatrixChart() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const [selectedAward, setSelectedAward] = useState<AwardMatrixPoint | null>(null)
  const scrollElRef = useRef<HTMLDivElement | null>(null)
  const didInitialScroll = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // Initial fetch
  useEffect(() => {
    const ac = new AbortController()
    abortRef.current = ac
    const end = todayIso()
    const start = shiftMonths(end, -INITIAL_WINDOW_MONTHS)

    fetchRange(start, end, ac.signal)
      .then((data) => {
        if (data && !ac.signal.aborted) dispatch({type: 'INITIAL_SUCCESS', payload: data})
        else if (!ac.signal.aborted) dispatch({type: 'INITIAL_ERROR'})
      })
      .catch(() => {
        if (!ac.signal.aborted) dispatch({type: 'INITIAL_ERROR'})
      })

    return () => ac.abort()
  }, [])

  // Scroll to right after initial load
  useLayoutEffect(() => {
    if (!state.initialLoading && !state.error && !didInitialScroll.current) {
      const el = scrollElRef.current
      if (el) {
        el.scrollLeft = el.scrollWidth
        didInitialScroll.current = true
      }
    }
  }, [state.initialLoading, state.error])

  // Scroll preservation after left-prepend
  useLayoutEffect(() => {
    if (state.prevScrollWidth !== null) {
      const el = scrollElRef.current
      if (el) {
        const delta = el.scrollWidth - state.prevScrollWidth
        el.scrollLeft += delta
      }
    }
  }, [state.prevScrollWidth, state.points.size])

  const fetchLeft = useCallback(() => {
    if (state.loadingLeft || !state.hasMoreLeft || !state.rangeStart) return
    const el = scrollElRef.current
    if (!el) return

    const prevScrollWidth = el.scrollWidth
    dispatch({type: 'FETCH_LEFT_START', prevScrollWidth})

    const newStart = shiftMonths(state.rangeStart, -FETCH_WINDOW_MONTHS)
    const clampedStart = newStart < LEFT_FLOOR ? LEFT_FLOOR : newStart

    const ac = new AbortController()
    fetchRange(clampedStart, state.rangeStart, ac.signal)
      .then((data) => {
        if (data && !ac.signal.aborted) dispatch({type: 'FETCH_LEFT_SUCCESS', payload: data})
        else if (!ac.signal.aborted) dispatch({type: 'FETCH_LEFT_ERROR'})
      })
      .catch(() => {
        if (!ac.signal.aborted) dispatch({type: 'FETCH_LEFT_ERROR'})
      })
  }, [state.loadingLeft, state.hasMoreLeft, state.rangeStart])

  const fetchRight = useCallback(() => {
    if (state.loadingRight || !state.hasMoreRight || !state.rangeEnd) return

    dispatch({type: 'FETCH_RIGHT_START'})

    const today = todayIso()
    const newEnd = shiftMonths(state.rangeEnd, FETCH_WINDOW_MONTHS)
    const clampedEnd = newEnd > today ? today : newEnd

    const ac = new AbortController()
    fetchRange(state.rangeEnd, clampedEnd, ac.signal)
      .then((data) => {
        if (data && !ac.signal.aborted) dispatch({type: 'FETCH_RIGHT_SUCCESS', payload: data})
        else if (!ac.signal.aborted) dispatch({type: 'FETCH_RIGHT_ERROR'})
      })
      .catch(() => {
        if (!ac.signal.aborted) dispatch({type: 'FETCH_RIGHT_ERROR'})
      })
  }, [state.loadingRight, state.hasMoreRight, state.rangeEnd])

  // Scroll listener
  const handleScroll = useCallback(() => {
    const el = scrollElRef.current
    if (!el) return

    if (el.scrollLeft < SCROLL_THRESHOLD) fetchLeft()

    const distFromRight = el.scrollWidth - el.scrollLeft - el.clientWidth
    if (distFromRight < SCROLL_THRESHOLD) fetchRight()
  }, [fetchLeft, fetchRight])

  useEffect(() => {
    const el = scrollElRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, {passive: true})
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const setScrollEl = useCallback((el: HTMLDivElement | null) => {
    scrollElRef.current = el
  }, [])

  const allPoints = useMemo(() => [...state.points.values()], [state.points])

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-3">
        <CardTitle className="font-display text-[1.45rem] leading-tight">Award matrix</CardTitle>
        <p className="text-muted-foreground text-sm">
          Top DoD contract awards by total obligation. Scroll left to explore older data.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.initialLoading ? (
          <div className="flex h-[420px] items-center justify-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading award data&hellip;</p>
          </div>
        ) : state.error || allPoints.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recent awards found.</p>
        ) : (
            <AwardMatrixChartContent
              points={allPoints}
              rangeStart={state.rangeStart}
              rangeEnd={state.rangeEnd}
              loadingLeft={state.loadingLeft}
              loadingRight={state.loadingRight}
              hasMoreLeft={state.hasMoreLeft}
              hasMoreRight={state.hasMoreRight}
              onScrollRef={setScrollEl}
              onSelectAward={setSelectedAward}
            />
        )}

        {selectedAward && (
          <AwardDetailPanel award={selectedAward} onClose={() => setSelectedAward(null)} />
        )}

        <p className="text-xs text-muted-foreground">
          Source: USAspending.gov &middot; DoD contract awards
          {state.rangeStart && state.rangeEnd
            ? ` \u00B7 ${formatMonthYear(state.rangeStart)} \u2013 ${formatMonthYear(state.rangeEnd)}`
            : ''}
        </p>

        {!state.initialLoading && allPoints.length > 0 && (
          <ContractSearchPanel allPoints={allPoints} />
        )}
      </CardContent>
    </Card>
  )
}
