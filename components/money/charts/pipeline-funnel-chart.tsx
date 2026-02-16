'use client'

import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {SamGovPipelineBucketSummary} from '@/lib/data/signals/sam-gov-server'

type PipelineFunnelChartProps = {
  solicitations: number
  presolicitations: number
  pipelineByBucket: SamGovPipelineBucketSummary[]
  totalActive: number
}

export function PipelineFunnelChart({solicitations, presolicitations, pipelineByBucket, totalActive}: PipelineFunnelChartProps) {
  const funnelData = [
    {stage: 'Pre-solicitation', count: presolicitations, fill: 'var(--chart-2)'},
    {stage: 'Solicitation', count: solicitations, fill: 'var(--chart-1)'},
  ]

  const bucketData = pipelineByBucket.slice(0, 8).map((entry) => ({
    bucket: entry.bucketLabel,
    count: entry.count,
  }))

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-[1.45rem] leading-tight">Pipeline funnel</CardTitle>
        <p className="text-muted-foreground text-sm">
          SAM.gov DoD opportunity pipeline — {totalActive} active opportunities.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalActive === 0 ? (
          <p className="text-muted-foreground text-sm">No SAM.gov pipeline data available yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {funnelData.map((stage) => (
                <div key={stage.stage} className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">{stage.stage}</p>
                  <p className="text-2xl font-semibold" style={{color: stage.fill}}>{stage.count}</p>
                </div>
              ))}
            </div>

            {bucketData.length > 0 ? (
              <div className="h-[200px] w-full" role="img" aria-label="Pipeline by bucket chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bucketData} layout="vertical" margin={{top: 4, right: 10, left: 0, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{fill: 'var(--muted-foreground)', fontSize: 11}} />
                    <YAxis
                      type="category"
                      dataKey="bucket"
                      tick={{fill: 'var(--muted-foreground)', fontSize: 10}}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.6rem',
                        fontSize: '0.85rem',
                      }}
                    />
                    <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
