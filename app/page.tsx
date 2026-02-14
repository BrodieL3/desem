import Link from 'next/link'
import type {ReactNode} from 'react'

import {buildHomeEditionLayout} from '@/lib/editorial/home-layout'
import {resolveInternalStoryHref} from '@/lib/editorial/linking'
import type {CuratedHomeForYouRail, CuratedStoryCard} from '@/lib/editorial/ui-types'
import {getCuratedHomeData} from '@/lib/editorial/ui-server'
import {getUserSession} from '@/lib/user/session'
import {RightRailTopics} from '@/components/editorial/right-rail-topics'
import {SectionLabel} from '@/components/editorial/section-label'

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

function compactText(value: string, maxChars: number) {
  const normalized = value.trim().replace(/\s+/g, ' ')

  if (normalized.length <= maxChars) {
    return normalized
  }

  const slice = normalized.slice(0, maxChars + 1)
  const breakIndex = slice.lastIndexOf(' ')
  const bounded = breakIndex > Math.floor(maxChars * 0.6) ? slice.slice(0, breakIndex) : slice.slice(0, maxChars)
  return `${bounded.trimEnd()}...`
}

function compactStorySummary(story: CuratedStoryCard, maxChars = 180) {
  const raw = story.whyItMatters.trim() || story.dek.trim() || ''
  return raw ? compactText(raw, maxChars) : ''
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
  className: string
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
  const summary = compactStorySummary(story, 220)

  return (
    <article className="news-divider-item px-1 md:py-6">
      <StoryTitleLink
        story={story}
        className="group block rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-muted-foreground mb-3 text-xs tracking-[0.12em] uppercase">
          {story.sourceName} · {formatStoryTimestamp(story.publishedAt)} · {story.citationCount} sources
        </p>

        <h2 className="font-display text-[2.55rem] leading-[1.01] text-foreground transition-colors group-hover:text-primary md:text-[3.35rem]">
          {story.headline}
        </h2>

        {summary ? <p className="text-muted-foreground mt-4 max-w-4xl text-[1.14rem] leading-relaxed">{summary}</p> : null}

        {story.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.imageUrl} alt={story.headline} className="mt-5 h-[25rem] w-full object-cover" loading="lazy" />
        ) : null}
      </StoryTitleLink>
    </article>
  )
}

function SectionStoryRow({story, showSummary = true, showImage = false}: {story: CuratedStoryCard; showSummary?: boolean; showImage?: boolean}) {
  const summary = compactStorySummary(story, 170)

  return (
    <article className="news-divider-item px-1">
      <StoryTitleLink
        story={story}
        className="group block rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-muted-foreground mb-2 text-xs tracking-[0.12em] uppercase">
          {story.sourceName} · {formatStoryTimestamp(story.publishedAt)}
        </p>

        <h3 className="font-display text-[1.92rem] leading-[1.08] text-foreground transition-colors group-hover:text-primary">
          {story.headline}
        </h3>

        {showImage && story.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.imageUrl} alt={story.headline} className="mt-3 h-44 w-full object-cover" loading="lazy" />
        ) : null}

        {showSummary && summary ? <p className="text-muted-foreground mt-2 text-[1.03rem] leading-relaxed">{summary}</p> : null}
      </StoryTitleLink>
    </article>
  )
}

function WireStoryRow({story}: {story: CuratedStoryCard}) {
  return (
    <article className="news-divider-item news-divider-item-compact px-1">
      <StoryTitleLink
        story={story}
        className="group block rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-muted-foreground mb-1 text-xs tracking-[0.12em] uppercase">
          {story.sourceName} · {formatStoryTimestamp(story.publishedAt)}
        </p>

        <h3 className="font-display text-[1.6rem] leading-tight text-foreground transition-colors group-hover:text-primary">
          {story.headline}
        </h3>
      </StoryTitleLink>
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
      <SectionLabel id={`${heading.toLowerCase()}-heading`} withRule>
        {heading}
      </SectionLabel>

      {stories.length === 0 ? (
        <p className="news-divider-list news-divider-item px-1 text-sm text-muted-foreground">No stories.</p>
      ) : (
        <div className="news-divider-list">
          {stories.map((story, index) => (
            <SectionStoryRow key={story.clusterKey} story={story} showImage={index === 0} showSummary={index < 2} />
          ))}
        </div>
      )}
    </section>
  )
}

function ForYouStoryRow({story, showImage}: {story: CuratedStoryCard; showImage: boolean}) {
  return (
    <article className="news-divider-item news-divider-item-compact px-1">
      <StoryTitleLink
        story={story}
        className="group block rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-muted-foreground mb-1 text-xs tracking-[0.12em] uppercase">
          {story.sourceName} · {formatStoryTimestamp(story.publishedAt)}
        </p>

        <h3 className="font-display text-[1.45rem] leading-tight text-foreground transition-colors group-hover:text-primary">
          {story.headline}
        </h3>

        {showImage && story.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.imageUrl} alt={story.headline} className="mt-3 h-36 w-full object-cover" loading="lazy" />
        ) : null}
      </StoryTitleLink>
    </article>
  )
}

function ForYouRail({rail}: {rail: CuratedHomeForYouRail | null}) {
  if (!rail) {
    return null
  }

  return (
    <section className="space-y-4" aria-labelledby="for-you-heading">
      <SectionLabel id="for-you-heading">
        {rail.title}
      </SectionLabel>

      {rail.notice ? <p className="text-muted-foreground text-sm">{rail.notice}</p> : null}

      <RightRailTopics topics={rail.topics} />

      {rail.stories.length === 0 ? (
        <p className="news-divider-list news-divider-list-no-top news-divider-item px-1 text-sm text-muted-foreground">
          No stories in this rail yet.
        </p>
      ) : (
        <div className="news-divider-list news-divider-list-no-top">
          {rail.stories.map((story, index) => (
            <ForYouStoryRow key={story.clusterKey} story={story} showImage={index === 0} />
          ))}
        </div>
      )}
    </section>
  )
}

export default async function HomePage() {
  const session = await getUserSession()
  const home = await getCuratedHomeData({
    limit: 84,
    fallbackRaw: true,
    userId: session.userId,
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
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-10">
              <section aria-labelledby="lead-heading">
                <SectionLabel id="lead-heading">
                  Lead
                </SectionLabel>
                <div className="news-divider-list news-divider-list-no-top">
                  <LeadStory story={layout.lead} />
                </div>
              </section>

              <section aria-labelledby="edition-columns-heading" className="space-y-4">
                <SectionLabel id="edition-columns-heading" withRule>
                  Edition
                </SectionLabel>

                <div className="grid gap-6 lg:grid-cols-3">
                  <HomeColumnSection heading="Signals" stories={layout.signals} />
                  <HomeColumnSection heading="World" stories={layout.world} className="news-column-rule" />
                  <HomeColumnSection heading="Industry" stories={layout.industry} className="news-column-rule" />
                </div>
              </section>

              <section aria-labelledby="wire-heading" className="space-y-4">
                <SectionLabel id="wire-heading">
                  Wire
                </SectionLabel>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="news-divider-list news-divider-list-no-top">
                    {wireLeft.map((story) => (
                      <WireStoryRow key={story.clusterKey} story={story} />
                    ))}
                  </div>
                  <div className="news-divider-list news-divider-list-no-top news-column-rule">
                    {wireRight.map((story) => (
                      <WireStoryRow key={story.clusterKey} story={story} />
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <aside className="news-column-rule space-y-4 lg:sticky lg:top-4 lg:self-start">
              <ForYouRail rail={home.forYou} />
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}
