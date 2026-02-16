'use client'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'

export type NewsMoneyHeatmapCell = {
  topicLabel: string
  bucket: string
  bucketLabel: string
  count: number
}

type NewsMoneyHeatmapProps = {
  cells: NewsMoneyHeatmapCell[]
  topicLabels: string[]
  bucketLabels: string[]
}

function intensityClass(count: number) {
  if (count === 0) {
    return 'bg-muted/30'
  }

  if (count === 1) {
    return 'bg-chart-1/20'
  }

  if (count <= 3) {
    return 'bg-chart-1/40'
  }

  if (count <= 6) {
    return 'bg-chart-1/60'
  }

  return 'bg-chart-1/80'
}

export function NewsMoneyHeatmap({cells, topicLabels, bucketLabels}: NewsMoneyHeatmapProps) {
  const hasData = cells.length > 0 && cells.some((cell) => cell.count > 0)

  const cellMap = new Map<string, number>()

  for (const cell of cells) {
    cellMap.set(`${cell.topicLabel}:${cell.bucketLabel}`, cell.count)
  }

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.45rem] leading-tight">News-to-money correlation</CardTitle>
        <p className="text-muted-foreground text-sm">
          Cross-reference between editorial topics and contract spending buckets.
        </p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-muted-foreground text-sm">No cross-reference data available yet. Correlations appear after articles and contracts are linked.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-1.5 text-muted-foreground font-normal" />
                  {bucketLabels.map((label) => (
                    <th key={label} className="p-1.5 text-center text-muted-foreground font-normal truncate max-w-[72px]">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topicLabels.map((topic) => (
                  <tr key={topic}>
                    <td className="p-1.5 text-muted-foreground truncate max-w-[120px]">{topic}</td>
                    {bucketLabels.map((bucket) => {
                      const count = cellMap.get(`${topic}:${bucket}`) ?? 0
                      return (
                        <td key={bucket} className="p-1">
                          <div
                            className={`flex items-center justify-center rounded h-7 w-full text-[10px] ${intensityClass(count)}`}
                            title={`${topic} × ${bucket}: ${count}`}
                          >
                            {count > 0 ? count : ''}
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
