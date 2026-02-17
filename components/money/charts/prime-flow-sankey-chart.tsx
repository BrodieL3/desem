'use client'

import {useState} from 'react'
import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Sankey, Tooltip, XAxis, YAxis} from 'recharts'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {PrimeFlowData} from '@/lib/data/signals/charts-server'

type PrimeFlowSankeyChartProps = {
  data: PrimeFlowData
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

function formatAxisDollars(value: number) {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)}M`
  }

  return `$${value.toFixed(0)}`
}

type SankeyNodePayload = {
  name: string
  colorToken?: string
  value?: number
  x: number
  y: number
  width: number
  height: number
  depth?: number
}

type NodeRenderProps = {
  x: number
  y: number
  width: number
  height: number
  index: number
  payload: SankeyNodePayload
}

function CustomNode({x, y, width, height, payload}: NodeRenderProps) {
  const fill = payload.colorToken ?? 'var(--muted-foreground)'

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />
      <text
        x={x + width + 6}
        y={y + height / 2}
        dy="0.35em"
        fontSize={10}
        fill="var(--muted-foreground)"
        textAnchor="start"
      >
        {payload.name}
      </text>
    </g>
  )
}

type SankeyLinkPayload = {
  source: SankeyNodePayload
  target: SankeyNodePayload
  value: number
}

type LinkRenderProps = {
  sourceX: number
  targetX: number
  sourceY: number
  targetY: number
  sourceControlX: number
  targetControlX: number
  linkWidth: number
  index: number
  payload: SankeyLinkPayload
}

function CustomLink(props: LinkRenderProps) {
  const {sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload, index} = props
  const sourceColor = payload.source?.colorToken ?? 'var(--muted-foreground)'

  return (
    <path
      d={`
        M${sourceX},${sourceY}
        C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
      `}
      fill="none"
      stroke={sourceColor}
      strokeWidth={linkWidth}
      strokeOpacity={0.3}
      key={index}
    />
  )
}

function StackedBarFallback({data}: {data: PrimeFlowData}) {
  // Build data for stacked bar: one bar per prime, segments per category
  const categoryNodes = data.nodes.filter((n) => n.colorToken)
  const primeNodes = data.nodes.filter((n) => !n.colorToken)

  // Only use prime→category links (source is a prime, target is a category)
  const categoryIndices = new Map(categoryNodes.map((n, idx) => [primeNodes.length + idx, n]))

  const barData = primeNodes.map((prime, primeIdx) => {
    const entry: Record<string, string | number> = {name: prime.name.length > 15 ? `${prime.name.slice(0, 15)}...` : prime.name}

    for (const link of data.links) {
      if (link.source === primeIdx) {
        const catNode = categoryIndices.get(link.target)
        if (catNode) {
          entry[catNode.name] = link.value
        }
      }
    }

    return entry
  })

  return (
    <div className="h-[420px] w-full" role="img" aria-label="Prime contract flow bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={barData} margin={{top: 8, right: 10, left: 0, bottom: 60}}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{fill: 'var(--muted-foreground)', fontSize: 10}}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{fill: 'var(--muted-foreground)', fontSize: 11}} tickFormatter={formatAxisDollars} width={58} />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '0.6rem',
              fontSize: '0.85rem',
            }}
            formatter={(value) => formatCompact(Number(value ?? 0))}
          />
          {categoryNodes.map((node) => (
            <Bar
              key={node.name}
              dataKey={node.name}
              stackId="stack"
              fill={node.colorToken ?? 'var(--muted-foreground)'}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PrimeFlowSankeyChart({data}: PrimeFlowSankeyChartProps) {
  const [useFallback, setUseFallback] = useState(false)

  if (data.insufficientData || data.nodes.length === 0) {
    return (
      <Card className="rounded-lg border border-border bg-card">
        <CardHeader className="space-y-1">
          <CardTitle className="font-display text-[1.45rem] leading-tight">Prime contract flow</CardTitle>
          <p className="text-muted-foreground text-sm">Award volume: top recipients → categories → contract sizes.</p>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Not enough award data to render flow diagram.</p>
        </CardContent>
      </Card>
    )
  }

  // Pass colorToken through in node data so custom renderers can use it
  const sankeyData = {
    nodes: data.nodes.map((n) => ({...n})),
    links: data.links.map((l) => ({...l})),
  }

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-[1.45rem] leading-tight">Prime contract flow</CardTitle>
          <button
            type="button"
            onClick={() => setUseFallback(!useFallback)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {useFallback ? 'Sankey view' : 'Bar view'}
          </button>
        </div>
        <p className="text-muted-foreground text-sm">Award volume: top recipients → categories → contract sizes.</p>
      </CardHeader>
      <CardContent>
        {useFallback ? (
          <StackedBarFallback data={data} />
        ) : (
          <div className="h-[420px] w-full" role="img" aria-label="Prime contract flow Sankey diagram">
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={sankeyData}
                nodeWidth={10}
                nodePadding={14}
                margin={{top: 8, right: 120, left: 10, bottom: 8}}
                link={<CustomLink sourceX={0} targetX={0} sourceY={0} targetY={0} sourceControlX={0} targetControlX={0} linkWidth={0} index={0} payload={{source: {} as SankeyNodePayload, target: {} as SankeyNodePayload, value: 0}} />}
                node={<CustomNode x={0} y={0} width={0} height={0} index={0} payload={{name: '', x: 0, y: 0, width: 0, height: 0}} />}
              >
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.6rem',
                    fontSize: '0.85rem',
                  }}
                  formatter={(value) => formatCompact(Number(value ?? 0))}
                />
              </Sankey>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
