'use client'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {CategoryMomentumData, MomentumCell} from '@/lib/data/signals/charts-server'

type CategoryMomentumHeatmapProps = {
  data: CategoryMomentumData
}

function formatCompact(value: number) {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }

  return `$${value.toFixed(0)}`
}

function directionArrow(direction: MomentumCell['direction']) {
  if (direction === 'growing') return '\u2191'
  if (direction === 'declining') return '\u2193'
  return '\u2013'
}

function cellStyle(cell: MomentumCell) {
  if (cell.direction === 'growing') {
    const opacity = Math.abs(cell.acceleration) > 0.3 ? '20%' : Math.abs(cell.acceleration) > 0.15 ? '40%' : '60%'
    return {backgroundColor: `color-mix(in oklch, var(--success), transparent ${opacity})`}
  }

  if (cell.direction === 'declining') {
    const opacity = Math.abs(cell.acceleration) > 0.3 ? '20%' : Math.abs(cell.acceleration) > 0.15 ? '40%' : '60%'
    return {backgroundColor: `color-mix(in oklch, var(--destructive), transparent ${opacity})`}
  }

  return {}
}

function FallbackBarChart({data}: {data: CategoryMomentumData}) {
  // Show just the latest week as a bar chart
  const latestWeek = data.weeks[data.weeks.length - 1]
  const latestCells = data.cells.filter((c) => c.weekLabel === latestWeek)
  const maxAmount = Math.max(...latestCells.map((c) => c.amount), 1)

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Latest week: {latestWeek}</p>
      {latestCells.map((cell) => (
        <div key={cell.bucket} className="flex items-center gap-2 text-xs">
          <span className="w-20 truncate text-muted-foreground">{cell.bucketLabel}</span>
          <div className="flex-1 h-5 rounded bg-muted/30 overflow-hidden">
            <div
              className="h-full rounded bg-chart-1/60"
              style={{width: `${Math.max((cell.amount / maxAmount) * 100, 2)}%`}}
            />
          </div>
          <span className="w-14 text-right tabular-nums">{formatCompact(cell.amount)}</span>
        </div>
      ))}
    </div>
  )
}

export function CategoryMomentumHeatmap({data}: CategoryMomentumHeatmapProps) {
  if (data.cells.length === 0) {
    return (
      <Card className="rounded-lg border border-border bg-card">
        <CardHeader className="space-y-1">
          <CardTitle className="font-display text-[1.45rem] leading-tight">Category momentum</CardTitle>
          <p className="text-muted-foreground text-sm">Week-over-week spending acceleration by category.</p>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Not enough weekly data yet.</p>
        </CardContent>
      </Card>
    )
  }

  const cellMap = new Map<string, MomentumCell>()

  for (const cell of data.cells) {
    cellMap.set(`${cell.bucket}:${cell.weekLabel}`, cell)
  }

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.45rem] leading-tight">Category momentum</CardTitle>
        <p className="text-muted-foreground text-sm">Week-over-week spending acceleration by category.</p>
      </CardHeader>
      <CardContent>
        {data.insufficientData ? (
          <FallbackBarChart data={data} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card text-left p-1.5 text-muted-foreground font-normal" />
                  {data.weeks.map((week) => (
                    <th key={week} className="p-1.5 text-center text-muted-foreground font-normal whitespace-nowrap">
                      {week}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.buckets.map((bucket) => (
                  <tr key={bucket}>
                    <td className="sticky left-0 z-10 bg-card p-1.5 text-muted-foreground whitespace-nowrap">
                      {cellMap.get(`${bucket}:${data.weeks[0]}`)?.bucketLabel ?? bucket}
                    </td>
                    {data.weeks.map((week) => {
                      const cell = cellMap.get(`${bucket}:${week}`)

                      if (!cell) {
                        return (
                          <td key={week} className="p-1">
                            <div className="flex items-center justify-center rounded h-7 w-full bg-muted/30" />
                          </td>
                        )
                      }

                      return (
                        <td key={week} className="p-1">
                          <div
                            className="flex items-center justify-center rounded h-7 w-full text-[10px] tabular-nums"
                            style={cell.direction === 'flat' ? {} : cellStyle(cell)}
                            title={`${cell.bucketLabel} ${cell.weekLabel}: ${formatCompact(cell.amount)} (${(cell.acceleration * 100).toFixed(1)}%)`}
                          >
                            {cell.direction === 'flat' ? (
                              <span className="bg-muted/30 rounded px-1">{formatCompact(cell.amount)} {directionArrow(cell.direction)}</span>
                            ) : (
                              <span>{formatCompact(cell.amount)} {directionArrow(cell.direction)}</span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
