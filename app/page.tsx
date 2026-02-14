import Link from 'next/link'
import type {ReactNode} from 'react'

import {buildHomeEditionLayout} from '@/lib/editorial/home-layout'
import {resolveInternalStoryHref} from '@/lib/editorial/linking'
import type {CuratedStoryCard} from '@/lib/editorial/ui-types'
import {getCuratedHomeData} from '@/lib/editorial/ui-server'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const storyTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatStoryTimestamp(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return storyTimeFormatter.format(parsed)
}

function compactStorySummary(story: CuratedStoryCard) {
  return story.whyItMatters.trim() || story.dek.trim() || ''
}

function resolveStoryHref(story: CuratedStoryCard) {
  return resolveInternalStoryHref({
    articleId: story.sourceLinks[0]?.articleId,
    clusterKey: story.clusterKey,
  })
}

function splitForWireColumns(stories: CuratedStoryCard[]) {
  const left: CuratedStoryCard[] = []
  const right: CuratedStoryCard[] = []

  stories.forEach((story, index) => {
    if (index % 2 === 0) {
      left.push(story)
      return
    }

    right.push(story)
  })

  return [left, right] as const
}

type StoryTitleLinkProps = {
  story: CuratedStoryCard
  className?: string
  children: ReactNode
}

function StoryTitleLink({story, className, children}: StoryTitleLinkProps) {
  return (
    <Link href={resolveStoryHref(story)} className={className}>
      {children}
    </Link>
  )
}

function LeadStory({story}: {story: CuratedStoryCard}) {
  const summary = compactStorySummary(story)

  return (
    <article className="news-divider-item px-1 md:py-6">
      <p className="text-muted-foreground mb-3 text-xs tracking-[0.12em] uppercase">
        {story.sourceName} · {formatStoryTimestamp(story.publishedAt)} · {story.citationCount} sources
      </p>

      <h2 className="font-display text-[2.55rem] leading-[1.01] text-foreground md:text-[3.35rem]">
        <StoryTitleLink story={story} className="hover:text-primary">
          {story.headline}
        </StoryTitleLink>
      </h2>

      {summary ? <p className="text-muted-foreground mt-4 max-w-4xl text-[1.14rem] leading-relaxed">{summary}</p> : null}

      {story.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={story.imageUrl} alt={story.headline} className="mt-5 h-[25rem] w-full object-cover" loading="lazy" />
      ) : null}
    </article>
  )
}

function SectionStoryRow({story, showSummary = true}: {story: CuratedStoryCard; showSummary?: boolean}) {
  const summary = compactStorySummary(story)

  return (
    <article className="news-divider-item px-1">
      <p className="text-muted-foreground mb-2 text-xs tracking-[0.12em] uppercase">
        {story.sourceName} · {formatStoryTimestamp(story.publishedAt)}
      </p>

      <h3 className="font-display text-[1.92rem] leading-[1.08] text-foreground">
        <StoryTitleLink story={story} className="hover:text-primary">
          {story.headline}
        </StoryTitleLink>
      </h3>

      {showSummary && summary ? <p className="text-muted-foreground mt-2 text-[1.03rem] leading-relaxed">{summary}</p> : null}
    </article>
  )
}

function WireStoryRow({story}: {story: CuratedStoryCard}) {
  return (
    <article className="news-divider-item news-divider-item-compact px-1">
      <p className="text-muted-foreground mb-1 text-xs tracking-[0.12em] uppercase">
        {story.sourceName} · {formatStoryTimestamp(story.publishedAt)}
      </p>

      <h3 className="font-display text-[1.6rem] leading-tight text-foreground">
        <StoryTitleLink story={story} className="hover:text-primary">
          {story.headline}
        </StoryTitleLink>
      </h3>
    </article>
  )
}

type HomeColumnSectionProps = {
  heading: string
  stories: CuratedStoryCard[]
  className?: string
}

function HomeColumnSection({heading, stories, className}: HomeColumnSectionProps) {
  return (
    <section className={className} aria-labelledby={`${heading.toLowerCase()}-heading`}>
      <h2 id={`${heading.toLowerCase()}-heading`} className="border-t border-border pt-4 text-xs tracking-[0.16em] uppercase text-muted-foreground">
        {heading}
      </h2>

      {stories.length === 0 ? (
        <p className="news-divider-list news-divider-item px-1 text-sm text-muted-foreground">No stories.</p>
      ) : (
        <div className="news-divider-list">
          {stories.map((story) => (
            <SectionStoryRow key={story.clusterKey} story={story} />
          ))}
        </div>
      )}
    </section>
  )
}

export default async function HomePage() {
  const home = await getCuratedHomeData({
    limit: 84,
    fallbackRaw: true,
  })

  const now = dateFormatter.format(new Date())
  const layout = buildHomeEditionLayout(home.stories)
  const [wireLeft, wireRight] = splitForWireColumns(layout.wire)

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[1320px] p-5 md:p-8">
        <header className="mb-8 border-b border-border pb-6 md:pb-8">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-3">
              <h1 className="font-display text-[3.25rem] leading-none text-foreground sm:text-[4.2rem] md:text-[4.7rem]">
                Field <span className="text-primary">Brief</span>
              </h1>
              <p className="text-muted-foreground text-xs tracking-[0.14em] uppercase">International defense desk</p>
              {home.notice ? <p className="text-muted-foreground text-sm">{home.notice}</p> : null}
            </div>

            <p className="text-muted-foreground text-xs tracking-[0.14em] uppercase">{now}</p>
          </div>
        </header>

        {!layout.lead ? (
          <p className="news-divider-list news-divider-item px-1 text-base text-muted-foreground">
            No international-event or U.S. defense-company stories are available yet.
          </p>
        ) : (
          <div className="space-y-10">
            <section aria-labelledby="lead-heading">
              <h2 id="lead-heading" className="border-t border-border pt-4 text-xs tracking-[0.16em] uppercase text-muted-foreground">
                Lead
              </h2>
              <LeadStory story={layout.lead} />
            </section>

            <section aria-labelledby="edition-columns-heading" className="space-y-4">
              <h2
                id="edition-columns-heading"
                className="border-t border-border pt-4 text-xs tracking-[0.16em] uppercase text-muted-foreground"
              >
                Edition
              </h2>

              <div className="grid gap-6 lg:grid-cols-3">
                <HomeColumnSection heading="Signals" stories={layout.signals} />
                <HomeColumnSection heading="World" stories={layout.world} className="news-column-rule" />
                <HomeColumnSection heading="Industry" stories={layout.industry} className="news-column-rule" />
              </div>
            </section>

            <section aria-labelledby="wire-heading" className="space-y-4">
              <h2 id="wire-heading" className="border-t border-border pt-4 text-xs tracking-[0.16em] uppercase text-muted-foreground">
                Wire
              </h2>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="news-divider-list">
                  {wireLeft.map((story) => (
                    <WireStoryRow key={story.clusterKey} story={story} />
                  ))}
                </div>
                <div className="news-divider-list news-column-rule">
                  {wireRight.map((story) => (
                    <WireStoryRow key={story.clusterKey} story={story} />
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
