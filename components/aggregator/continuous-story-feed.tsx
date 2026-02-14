'use client'

import Link from 'next/link'
import {useCallback, useEffect, useRef, useState} from 'react'

import {Button} from '@/components/ui/button'
import type {ArticleCard} from '@/lib/articles/types'

const storyTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const FEED_BATCH_SIZE = 12
const MAX_EMPTY_BATCHES = 3

type ArticleListApiResponse = {
  data?: ArticleCard[]
}

type ContinuousStoryFeedProps = {
  initialStories: ArticleCard[]
  excludeArticleIds?: string[]
  topicSlug?: string
  heading?: string
  description?: string
}

function formatStoryTimestamp(publishedAt: string | null, fetchedAt: string) {
  const parsed = new Date(publishedAt ?? fetchedAt)

  if (Number.isNaN(parsed.getTime())) {
    return publishedAt ?? fetchedAt
  }

  return storyTimeFormatter.format(parsed)
}

function storySummary(summary: string | null, excerpt: string | null) {
  return summary ?? excerpt ?? 'Open this story for the latest reporting and discussion.'
}

function FeedStoryCard({story}: {story: ArticleCard}) {
  return (
    <article className="news-divider-item px-1">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs tracking-[0.08em] uppercase">
        <span className="font-medium">{story.sourceName}</span>
        <span className="text-muted-foreground">{formatStoryTimestamp(story.publishedAt, story.fetchedAt)}</span>
      </div>

      <h3 className="font-display text-[1.7rem] leading-tight text-foreground">
        <Link href={`/articles/${story.id}`} className="hover:text-primary">
          {story.title}
        </Link>
      </h3>

      <p className="text-muted-foreground mt-2 text-base leading-relaxed">{storySummary(story.summary, story.fullTextExcerpt)}</p>
    </article>
  )
}

export function ContinuousStoryFeed({
  initialStories,
  excludeArticleIds = [],
  topicSlug,
  heading = 'More coverage',
  description,
}: ContinuousStoryFeedProps) {
  const [stories, setStories] = useState(initialStories)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const emptyBatchCountRef = useRef(0)
  const seenStoryIdsRef = useRef(
    new Set<string>([...excludeArticleIds, ...initialStories.map((story) => story.id)])
  )

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        limit: String(FEED_BATCH_SIZE),
        offset: String(offset),
      })

      if (topicSlug) {
        params.set('topic', topicSlug)
      }

      const response = await fetch(`/api/articles?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Unable to load additional stories.')
      }

      const payload = (await response.json()) as ArticleListApiResponse
      const incomingStories = payload.data ?? []
      setOffset((current) => current + FEED_BATCH_SIZE)

      if (incomingStories.length === 0) {
        setHasMore(false)
        setIsLoading(false)
        return
      }

      const uniqueStories = incomingStories.filter((story) => {
        if (seenStoryIdsRef.current.has(story.id)) {
          return false
        }

        seenStoryIdsRef.current.add(story.id)
        return true
      })

      if (uniqueStories.length === 0) {
        emptyBatchCountRef.current += 1

        if (incomingStories.length < FEED_BATCH_SIZE || emptyBatchCountRef.current >= MAX_EMPTY_BATCHES) {
          setHasMore(false)
        }
      } else {
        emptyBatchCountRef.current = 0
        setStories((current) => [...current, ...uniqueStories])
      }

      if (incomingStories.length < FEED_BATCH_SIZE) {
        setHasMore(false)
      }

      setIsLoading(false)
    } catch {
      setError('Unable to load additional stories.')
      setIsLoading(false)
    }
  }, [hasMore, isLoading, offset, topicSlug])

  useEffect(() => {
    if (!hasMore) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore()
        }
      },
      {
        rootMargin: '900px 0px 900px 0px',
      }
    )

    const sentinel = sentinelRef.current

    if (sentinel) {
      observer.observe(sentinel)
    }

    return () => observer.disconnect()
  }, [hasMore, loadMore])

  return (
    <section className="space-y-4" aria-labelledby="continuous-story-feed-heading">
      <header className="mx-auto max-w-[74ch] space-y-2 text-center">
        <h2 id="continuous-story-feed-heading" className="font-display text-[2.15rem] leading-tight">
          {heading}
        </h2>
        {description ? <p className="text-muted-foreground text-base">{description}</p> : null}
      </header>

      {stories.length === 0 ? (
        <p className="text-muted-foreground mx-auto max-w-[74ch] text-base text-center">No additional stories available.</p>
      ) : (
        <div className="news-divider-list">
          {stories.map((story) => (
            <FeedStoryCard key={story.id} story={story} />
          ))}
        </div>
      )}

      {error ? (
        <div className="space-y-2 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="ghost" onClick={() => void loadMore()}>
            Retry
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-3" aria-live="polite" aria-busy="true">
          <div className="h-24 animate-pulse bg-muted/45" />
          <div className="h-24 animate-pulse bg-muted/45" />
        </div>
      ) : null}

      {!hasMore ? <p className="text-muted-foreground text-center text-sm">Caught up.</p> : null}

      <div ref={sentinelRef} className="h-8" aria-hidden />
    </section>
  )
}
