import Link from 'next/link'

import {FollowTopicButton} from '@/components/aggregator/follow-topic-button'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {getHomeFeedData} from '@/lib/articles/server'
import {getUserSession} from '@/lib/user/session'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const headlineRiverCardVariants = ['river-card--signal', 'river-card--column', 'river-card--flash', 'river-card--analysis'] as const
const newsDeskCardVariants = ['desk-card--wire', 'desk-card--briefing', 'desk-card--focus'] as const

function formatTimestamp(value: string | null | undefined, fallback: string) {
  const candidate = value ?? fallback
  const parsed = new Date(candidate)

  if (Number.isNaN(parsed.getTime())) {
    return candidate
  }

  return timeFormatter.format(parsed)
}

export default async function HomePage() {
  const session = await getUserSession()
  const feed = await getHomeFeedData(session.userId)

  const lead = feed.articles[0] ?? null
  const headlineRiver = lead ? feed.articles.slice(1, 13) : feed.articles.slice(0, 12)
  const deskArticles = lead ? feed.articles.slice(13, 45) : feed.articles.slice(12, 44)
  const now = dateFormatter.format(new Date())

  return (
    <main className="min-h-screen px-3 py-4 md:px-6 md:py-7">
      <div className="editorial-shell mx-auto max-w-[1480px] overflow-hidden border-slate-300/80 bg-white/95">
        <header className="border-b border-slate-300/75 px-4 py-6 md:px-8">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Field Brief | Defense Desk</p>
              <h1 className="font-display text-5xl leading-none text-slate-900 sm:text-[4rem]">
                Field <span className="text-[var(--brand)]">Brief</span>
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
                Defense reporting aggregated in one newsroom experience. Read full-text coverage, follow the entities that
                matter, and join discussion around each story.
              </p>
            </div>
            <div className="space-y-2 text-right">
              <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">{now}</p>
              {session.isAuthenticated ? (
                <Button asChild size="sm" variant="outline" className="rounded-full border-slate-300 bg-white">
                  <Link href="/auth/sign-out">Sign out</Link>
                </Button>
              ) : (
                <Button asChild size="sm" className="rounded-full">
                  <Link href="/auth/sign-in?next=/">Sign in</Link>
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-6 px-4 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-6">
            {lead ? (
              <Card className="overflow-hidden border-slate-300/80 bg-white py-0">
                <CardContent className="grid gap-0 p-0 lg:grid-cols-[1.2fr_minmax(0,1fr)]">
                  <div className="space-y-4 p-6 md:p-8">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="border-slate-300 bg-white text-[11px] uppercase">
                        Lead Story
                      </Badge>
                      <span className="text-muted-foreground">{lead.sourceName}</span>
                      <span className="text-muted-foreground">{formatTimestamp(lead.publishedAt, lead.fetchedAt)}</span>
                    </div>

                    <h2 className="font-display text-4xl leading-tight text-slate-900 md:text-[2.8rem]">
                      <Link href={`/articles/${lead.id}`} className="transition-colors hover:text-[var(--brand)]">
                        {lead.title}
                      </Link>
                    </h2>

                    <p className="text-muted-foreground text-base leading-relaxed">
                      {lead.summary ?? lead.fullTextExcerpt ?? 'Full text available in Field Brief.'}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Button asChild className="rounded-full">
                        <Link href={`/articles/${lead.id}`}>Read full article</Link>
                      </Button>
                      <Button asChild variant="outline" className="rounded-full border-slate-300 bg-white">
                        <a href={lead.articleUrl} target="_blank" rel="noreferrer">
                          Open original source
                        </a>
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-slate-300/70 bg-slate-50 lg:border-t-0 lg:border-l">
                    {lead.leadImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={lead.leadImageUrl}
                        alt={lead.title}
                        className="h-64 w-full object-cover lg:h-full"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full min-h-[220px] items-center justify-center p-6">
                        <p className="font-display text-3xl leading-tight text-slate-700">Read the full story inside Field Brief</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-300/80 bg-white">
                <CardContent className="p-6 text-sm text-slate-600">No articles available yet. Run ingestion to populate the desk.</CardContent>
              </Card>
            )}

            <section className="space-y-3 border-t border-slate-300/70 pt-5">
              <div className="flex items-end justify-between gap-3">
                <h3 className="font-display text-3xl leading-tight text-slate-900">Headline river</h3>
                <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase">Latest coverage</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {headlineRiver.map((article, index) => (
                  <article
                    key={article.id}
                    className={`river-card ${headlineRiverCardVariants[index % headlineRiverCardVariants.length]}`}
                  >
                    <div className="river-card-meta mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium text-slate-700">{article.sourceName}</span>
                      <span className="text-muted-foreground">{formatTimestamp(article.publishedAt, article.fetchedAt)}</span>
                      {article.personalizationScore > 0 ? (
                        <Badge variant="secondary" className="river-card-chip rounded-full bg-[var(--brand)] text-[11px] text-white">
                          Followed topic match
                        </Badge>
                      ) : null}
                    </div>
                    <h4 className="river-card-title font-display text-[1.45rem] leading-tight text-slate-900">
                      <Link href={`/articles/${article.id}`} className="hover:text-[var(--brand)]">
                        {article.title}
                      </Link>
                    </h4>
                    <p className="river-card-excerpt text-muted-foreground mt-2 line-clamp-3 text-sm leading-relaxed">
                      {article.summary ?? article.fullTextExcerpt ?? 'Read full text on article page.'}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-3 border-t border-slate-300/70 pt-5">
              <div className="flex items-end justify-between gap-3">
                <h3 className="font-display text-3xl leading-tight text-slate-900">News desk</h3>
                <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase">{deskArticles.length} stories</p>
              </div>

              <div className="space-y-2">
                {deskArticles.map((article, index) => (
                  <article key={article.id} className={`desk-card ${newsDeskCardVariants[index % newsDeskCardVariants.length]}`}>
                    <div className="desk-card-meta mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium text-slate-700">{article.sourceName}</span>
                      <span className="text-muted-foreground">{formatTimestamp(article.publishedAt, article.fetchedAt)}</span>
                      {article.commentCount > 0 ? (
                        <span className="text-muted-foreground">{article.commentCount} comments</span>
                      ) : null}
                    </div>

                    <h4 className="desk-card-title font-display text-2xl leading-tight text-slate-900">
                      <Link href={`/articles/${article.id}`} className="hover:text-[var(--brand)]">
                        {article.title}
                      </Link>
                    </h4>

                    <p className="desk-card-excerpt text-muted-foreground mt-2 text-sm leading-relaxed">
                      {article.summary ?? article.fullTextExcerpt ?? 'Read full text on article page.'}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-4">
            {lead ? (
              <Card className="border-slate-300/75 bg-background">
                <CardHeader>
                  <CardTitle className="font-display text-3xl leading-tight">Lead topics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {lead.topics.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No topics extracted for this lead article.</p>
                  ) : (
                    lead.topics.slice(0, 10).map((topic) => (
                      <div
                        key={`lead-topic-${topic.id}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-300/75 bg-background px-3 py-2"
                      >
                        <Link href={`/topics/${topic.slug}`} className="text-sm font-medium text-slate-800 hover:text-[var(--brand)]">
                          {topic.label}
                        </Link>
                        <FollowTopicButton
                          topicId={topic.id}
                          initialFollowed={feed.followedTopics.some((followed) => followed.id === topic.id)}
                          isAuthenticated={session.isAuthenticated}
                          className="h-7 rounded-full px-2 text-[11px]"
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-slate-300/75 bg-background">
              <CardHeader>
                <CardTitle className="font-display text-3xl leading-tight">Trending topics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {feed.trendingTopics.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Topics appear after ingestion + extraction runs.</p>
                ) : (
                  feed.trendingTopics.map((topic) => (
                    <div key={topic.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-300/75 bg-background px-3 py-2">
                      <Link href={`/topics/${topic.slug}`} className="text-sm font-medium text-slate-800 hover:text-[var(--brand)]">
                        {topic.label}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">{topic.articleCount}</span>
                        <FollowTopicButton
                          topicId={topic.id}
                          initialFollowed={topic.followed}
                          isAuthenticated={session.isAuthenticated}
                          className="h-7 rounded-full px-2 text-[11px]"
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-300/75 bg-background">
              <CardHeader>
                <CardTitle className="font-display text-3xl leading-tight">Your followed topics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {session.isAuthenticated ? (
                  feed.followedTopics.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Follow topics from story chips to tune your ranking.</p>
                  ) : (
                    feed.followedTopics.map((topic) => (
                      <div key={topic.id} className="flex items-center justify-between rounded-xl border border-slate-300/75 bg-background px-3 py-2">
                        <Link href={`/topics/${topic.slug}`} className="text-sm font-medium hover:text-[var(--brand)]">
                          {topic.label}
                        </Link>
                        <span className="text-muted-foreground text-xs">{topic.articleCount}</span>
                      </div>
                    ))
                  )
                ) : (
                  <>
                    <p className="text-muted-foreground text-sm">Sign in to follow entities, programs, and technologies.</p>
                    <Button asChild size="sm" className="rounded-full">
                      <Link href="/auth/sign-in?next=/">Sign in</Link>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-300/75 bg-background">
              <CardHeader>
                <CardTitle className="font-display text-3xl leading-tight">Most discussed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {feed.mostDiscussed.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No active discussions yet.</p>
                ) : (
                  feed.mostDiscussed.map((article) => (
                    <Link
                      key={article.id}
                      href={`/articles/${article.id}`}
                      className="block rounded-xl border border-slate-300/75 bg-background px-3 py-2 hover:border-[var(--brand)]"
                    >
                      <p className="font-medium text-slate-800">{article.title}</p>
                      <p className="text-muted-foreground mt-1 text-xs">{article.commentCount} comments</p>
                    </Link>
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
