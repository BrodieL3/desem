'use client'

import Link from 'next/link'

import {actionLensLabel, type DefenseMoneyChartSummary} from '@/lib/data/signals/types'

type ChartSummaryBlockProps = {
  summary: DefenseMoneyChartSummary
}

function claimCitations(summary: DefenseMoneyChartSummary, citationIds: string[]) {
  const citationById = new Map(summary.citations.map((citation) => [citation.id, citation]))
  return citationIds.map((citationId) => citationById.get(citationId) ?? null).filter((citation) => citation !== null)
}

export function ChartSummaryBlock({summary}: ChartSummaryBlockProps) {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-muted-foreground text-xs tracking-[0.12em] uppercase">{actionLensLabel(summary.actionLens)}</p>

      {summary.claims.length === 0 ? (
        <p className="text-sm text-muted-foreground">{summary.sourceGapNote ?? 'Insufficient data to generate grounded claims for this period.'}</p>
      ) : (
        <div className="space-y-3">
          {summary.claims.map((claim) => {
            const citations = claimCitations(summary, claim.citationIds)

            return (
              <div key={claim.id} className="space-y-1">
                <p className="text-sm leading-relaxed text-foreground">{claim.text}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {citations.map((citation) => (
                    <Link
                      key={citation.id}
                      href={citation.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
                    >
                      {citation.sourceLabel ? `${citation.sourceLabel}: ` : ''}
                      {citation.label}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-muted-foreground text-sm">{summary.soWhat}</p>
    </div>
  )
}
