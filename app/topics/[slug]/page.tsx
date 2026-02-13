import Link from 'next/link'
import {notFound} from 'next/navigation'

import {FollowTopicButton} from '@/components/aggregator/follow-topic-button'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
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
    <main className="min-h-screen px-3 py-4 md:px-6 md:py-7">
      <div className="editorial-shell mx-auto max-w-[1320px] border-slate-300/80 bg-white/95 px-4 py-6 md:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/75 pb-5">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase">Topic Explorer</p>
            <h1 className="font-display text-4xl leading-tight text-slate-900 md:text-[3rem]">{data.topic.label}</h1>
            <p className="text-muted-foreground text-sm">Defense coverage and related entities in this cluster.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="rounded-full border-slate-300 bg-white">
              <Link href="/">Back to front page</Link>
            </Button>
            <FollowTopicButton
              topicId={data.topic.id}
              initialFollowed={data.isFollowed}
              isAuthenticated={session.isAuthenticated}
              className="rounded-full"
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="space-y-3">
            {data.articles.length === 0 ? (
              <Card className="border-slate-300/75 bg-white">
                <CardContent className="p-5 text-sm text-slate-600">No articles found for this topic yet.</CardContent>
              </Card>
            ) : (
              data.articles.map((article) => (
                <article key={article.id} className="rounded-xl border border-slate-300/75 bg-white p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-slate-700">{article.sourceName}</span>
                    <span className="text-muted-foreground">{dateFormatter.format(new Date(article.publishedAt ?? article.fetchedAt))}</span>
                    {article.commentCount > 0 ? <span className="text-muted-foreground">{article.commentCount} comments</span> : null}
                  </div>

                  <h2 className="font-display text-3xl leading-tight text-slate-900">
                    <Link href={`/articles/${article.id}`} className="hover:text-[var(--brand)]">
                      {article.title}
                    </Link>
                  </h2>

                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {article.summary ?? article.fullTextExcerpt ?? 'Read full text on the article page.'}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {article.topics.slice(0, 6).map((topic) => (
                      <Badge key={`${article.id}-${topic.id}`} variant="outline" className="border-slate-300 bg-white text-[11px]">
                        <Link href={`/topics/${topic.slug}`}>{topic.label}</Link>
                      </Badge>
                    ))}
                  </div>
                </article>
              ))
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Card className="border-slate-300/75 bg-white/95">
              <CardHeader>
                <CardTitle className="font-display text-3xl leading-tight">Co-occurring topics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.cooccurringTopics.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No co-occurring topics yet.</p>
                ) : (
                  data.cooccurringTopics.map((topic) => (
                    <div key={topic.id} className="flex items-center justify-between rounded-xl border border-slate-300/75 bg-white px-3 py-2">
                      <Link href={`/topics/${topic.slug}`} className="text-sm font-medium hover:text-[var(--brand)]">
                        {topic.label}
                      </Link>
                      <span className="text-muted-foreground text-xs">{topic.articleCount}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}
