import Link from 'next/link'
import {notFound} from 'next/navigation'

import {FollowTopicButton} from '@/components/aggregator/follow-topic-button'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {getTopicPageData} from '@/lib/articles/server'
import {getUserSession} from '@/lib/user/session'

type TopicPageProps = {
  params: Promise<{slug: string}>
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default async function TopicPage({params}: TopicPageProps) {
  const {slug} = await params
  const session = await getUserSession()

  const data = await getTopicPageData(slug, session.userId)

  if (!data) {
    notFound()
  }

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[1320px] p-5 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase">Topic explorer</p>
            <h1 className="font-display text-[2.4rem] leading-tight md:text-[3rem]">{data.topic.label}</h1>
            <p className="text-muted-foreground text-base">Defense coverage and related entities in this cluster.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Back to front page</Link>
            </Button>
            <FollowTopicButton
              topicId={data.topic.id}
              initialFollowed={data.isFollowed}
              isAuthenticated={session.isAuthenticated}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="space-y-3">
            {data.articles.length === 0 ? (
              <p className="py-5 text-base text-muted-foreground">No articles found for this topic yet.</p>
            ) : (
              <div className="news-divider-list">
                {data.articles.map((article) => (
                  <article key={article.id} className="news-divider-item px-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium">{article.sourceName}</span>
                      <span className="text-muted-foreground">{dateFormatter.format(new Date(article.publishedAt ?? article.fetchedAt))}</span>
                      {article.commentCount > 0 ? <span className="text-muted-foreground">{article.commentCount} comments</span> : null}
                    </div>

                    <h2 className="font-display text-[2rem] leading-tight">
                      <Link href={`/articles/${article.id}`} className="hover:text-primary">
                        {article.title}
                      </Link>
                    </h2>

                    <p className="text-muted-foreground mt-3 text-base leading-relaxed">
                      {article.summary ?? article.fullTextExcerpt ?? 'Read full text on the article page.'}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {article.topics.slice(0, 6).map((topic) => (
                        <Badge key={`${article.id}-${topic.id}`} variant="secondary" className="text-xs">
                          <Link href={`/topics/${topic.slug}`}>{topic.label}</Link>
                        </Badge>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <section className="space-y-3 border-t border-border pt-5">
              <h2 className="font-display text-3xl leading-tight">Co-occurring topics</h2>
              {data.cooccurringTopics.length === 0 ? (
                <p className="text-muted-foreground text-base">No co-occurring topics yet.</p>
              ) : (
                <div className="news-divider-list">
                  {data.cooccurringTopics.map((topic) => (
                    <div key={topic.id} className="news-divider-item flex items-center justify-between gap-2 px-1">
                      <Link href={`/topics/${topic.slug}`} className="text-sm font-medium hover:text-primary">
                        {topic.label}
                      </Link>
                      <span className="text-muted-foreground text-xs">{topic.articleCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
