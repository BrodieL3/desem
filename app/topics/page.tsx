import Link from 'next/link'

import {FollowTopicButton} from '@/components/aggregator/follow-topic-button'
import {Button} from '@/components/ui/button'
import {getHomeFeedData} from '@/lib/articles/server'
import {getUserSession} from '@/lib/user/session'

export default async function TopicsPage() {
  const session = await getUserSession()
  const homeFeed = await getHomeFeedData(session.userId)
  const followedById = new Map(homeFeed.followedTopics.map((topic) => [topic.id, topic] as const))
  const mergedTopics = [...homeFeed.followedTopics]

  for (const topic of homeFeed.trendingTopics) {
    if (followedById.has(topic.id)) {
      continue
    }

    mergedTopics.push(topic)

    if (mergedTopics.length >= 24) {
      break
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[980px] p-5 md:p-8">
        <header className="mb-6 space-y-3 border-b border-border pb-6 text-center">
          <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase">Topic settings</p>
          <h1 className="font-display text-[2.4rem] leading-tight md:text-[3rem]">Edit followed topics</h1>
          <p className="text-muted-foreground text-base">Control the topics that shape your For You rail.</p>
          <div className="flex items-center justify-center gap-2">
            <Button asChild variant="ghost" size="sm" className="min-h-11 px-4">
              <Link href="/">Back to front page</Link>
            </Button>
            {!session.isAuthenticated ? (
              <Button asChild size="sm" className="min-h-11 px-4">
                <Link href="/auth/sign-in?next=/topics">Sign in</Link>
              </Button>
            ) : null}
          </div>
        </header>

        {mergedTopics.length === 0 ? (
          <p className="news-divider-list news-divider-item px-1 text-base text-muted-foreground">No topics are available yet.</p>
        ) : (
          <section className="space-y-4" aria-labelledby="topics-list-heading">
            <h2 id="topics-list-heading" className="border-t border-border pt-4 text-xs tracking-[0.15em] uppercase text-muted-foreground">
              Topics
            </h2>

            <div className="news-divider-list">
              {mergedTopics.map((topic) => (
                <div key={topic.id} className="news-divider-item flex min-h-11 items-center justify-between gap-3 px-1">
                  <div className="space-y-1">
                    <Link href={`/topics/${topic.slug}`} className="font-medium hover:text-primary">
                      {topic.label}
                    </Link>
                    <p className="text-muted-foreground text-xs">{topic.articleCount} stories</p>
                  </div>

                  <FollowTopicButton
                    topicId={topic.id}
                    initialFollowed={topic.followed}
                    isAuthenticated={session.isAuthenticated}
                    className="h-11 px-3 text-xs"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
