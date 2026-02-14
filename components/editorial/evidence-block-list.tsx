'use client'

import Link from 'next/link'
import {useState} from 'react'

import {Button} from '@/components/ui/button'
import type {EvidenceBlock} from '@/lib/editorial/ui-types'
import {resolveInternalStoryHref} from '@/lib/editorial/linking'

type StoryApiResponse = {
  data?: {
    evidence?: EvidenceBlock[]
  }
}

type EvidenceBlockListProps = {
  clusterKey: string
  initialBlocks: EvidenceBlock[]
  totalEvidence: number
  batchSize?: number
}

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatDate(value: string | null) {
  if (!value) {
    return 'Date unavailable'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return timeFormatter.format(parsed)
}

export function EvidenceBlockList({clusterKey, initialBlocks, totalEvidence, batchSize = 8}: EvidenceBlockListProps) {
  const [blocks, setBlocks] = useState(initialBlocks)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(initialBlocks.length < totalEvidence)

  async function loadMore() {
    if (isLoading || !hasMore) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        offset: String(blocks.length),
        limit: String(batchSize),
      })

      const response = await fetch(`/api/editorial/stories/${encodeURIComponent(clusterKey)}?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Unable to load additional evidence blocks.')
      }

      const payload = (await response.json()) as StoryApiResponse
      const newBlocks = payload.data?.evidence ?? []

      if (newBlocks.length === 0) {
        setHasMore(false)
        setIsLoading(false)
        return
      }

      const nextCount = blocks.length + newBlocks.length
      setBlocks((current) => [...current, ...newBlocks])
      setHasMore(nextCount < totalEvidence)
      setIsLoading(false)
    } catch {
      setError('Unable to load additional evidence blocks.')
      setIsLoading(false)
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="evidence-heading">
      <div className="flex items-end justify-between gap-3">
        <h2 id="evidence-heading" className="font-display text-3xl leading-tight text-foreground">
          Linked reporting
        </h2>
        <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase">
          {blocks.length}/{totalEvidence}
        </p>
      </div>

      {blocks.length === 0 ? (
        <p className="text-muted-foreground text-base">No linked reporting available yet.</p>
      ) : (
        <ol className="news-divider-list">
          {blocks.map((block, index) => (
            <li key={block.id} className="news-divider-item px-1">
              <header className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-secondary rounded px-2 py-0.5 font-semibold">#{index + 1}</span>
                <span className="font-medium">{block.sourceName}</span>
                <span className="text-muted-foreground">{formatDate(block.publishedAt)}</span>
                {block.sourceBadge ? <span className="text-muted-foreground uppercase">{block.sourceBadge}</span> : null}
              </header>

              <h3 className="font-display text-[1.8rem] leading-tight text-foreground">
                <Link
                  href={resolveInternalStoryHref({
                    articleId: block.articleId,
                    clusterKey,
                  })}
                  className="hover:text-primary"
                >
                  {block.headline}
                </Link>
              </h3>

              <p className="text-muted-foreground mt-2 text-base leading-relaxed">{block.excerpt}</p>
            </li>
          ))}
        </ol>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {hasMore ? (
        <Button type="button" variant="ghost" onClick={loadMore} disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Load more'}
        </Button>
      ) : (
        <p className="text-muted-foreground text-base">All evidence blocks loaded.</p>
      )}
    </section>
  )
}
