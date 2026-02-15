import Link from 'next/link'

import {FollowTopicButton} from '@/components/aggregator/follow-topic-button'
import {Button} from '@/components/ui/button'
import type {CuratedHomeForYouTopic} from '@/lib/editorial/ui-types'

import {SectionLabel} from './section-label'

type TopicSpotlightProps = {
  topics: CuratedHomeForYouTopic[]
  isAuthenticated: boolean
  headingId?: string
}

export function TopicSpotlight({topics, isAuthenticated, headingId = 'topic-spotlight-heading'}: TopicSpotlightProps) {
  const spotlightTopics = topics.slice(0, 8)

  return (
    <section aria-labelledby={headingId} className="space-y-3 border-t border-border pt-5">
      <SectionLabel id={headingId}>Topic spotlight</SectionLabel>

      {!isAuthenticated ? (
        <p className="text-muted-foreground text-sm">
          <Link href="/auth/sign-in?next=/topics" className="underline-offset-2 hover:underline">
            Sign in
          </Link>{' '}
          to follow and tune topic alerts.
        </p>
      ) : null}

      {spotlightTopics.length === 0 ? (
        <p className="news-divider-list news-divider-list-no-top news-divider-item px-1 text-sm text-muted-foreground">
          No topics are available yet.
        </p>
      ) : (
        <div className="news-divider-list news-divider-list-no-top">
          {spotlightTopics.map((topic) => (
            <div
              key={topic.id}
              className="news-divider-item news-divider-item-compact flex min-h-11 items-center justify-between gap-3 px-1"
            >
              <div className="min-w-0">
                <Link href={`/topics/${topic.slug}`} className="text-sm font-medium hover:text-primary">
                  {topic.label}
                </Link>
                <p className="text-muted-foreground text-xs">{topic.articleCount} stories</p>
              </div>

              <FollowTopicButton
                topicId={topic.id}
                initialFollowed={topic.followed}
                isAuthenticated={isAuthenticated}
                className="h-11 px-3 text-xs"
              />
            </div>
          ))}
        </div>
      )}

      <Button asChild variant="ghost" size="sm" className="min-h-11 px-1 text-xs">
        <Link href="/topics">Browse all topics</Link>
      </Button>
    </section>
  )
}
