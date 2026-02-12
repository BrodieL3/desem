import Link from 'next/link'

import {BriefPoints} from '@/components/newsfeed/molecules/brief-points'
import {StoryMetaRow} from '@/components/newsfeed/molecules/story-meta-row'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {getBlendedAnalystBullets} from '@/lib/defense/stories'
import {getDomainVisualTheme} from '@/lib/defense/story-theme'
import type {DefenseSemaformStory} from '@/lib/defense/types'
import {cn} from '@/lib/utils'

type HeroStoryProps = {
  story: DefenseSemaformStory
}

export function HeroStory({story}: HeroStoryProps) {
  const blendedInsights = getBlendedAnalystBullets(story, 3)
  const visualTheme = getDomainVisualTheme(story.domain)

  return (
    <Card className="animate-rise overflow-hidden border-slate-300/80 bg-white/90 py-0 shadow-[0_24px_54px_-42px_rgba(15,23,42,0.7)]">
      <CardContent className="grid gap-0 p-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={cn('relative isolate flex min-h-[280px] flex-col justify-between overflow-hidden px-6 py-6', `bg-gradient-to-br ${visualTheme.gradientClass}`)}>
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute -top-14 right-[-4.5rem] h-48 w-48 rounded-full border border-white/30" />
            <div className="absolute bottom-[-5.5rem] left-[-3.5rem] h-40 w-40 rounded-full border border-white/30" />
            <div className="absolute inset-0 bg-[linear-gradient(125deg,transparent_36%,rgba(255,255,255,0.15)_40%,transparent_44%)]" />
          </div>
          <div className="relative space-y-2">
            <p className="text-xs font-semibold tracking-[0.2em] text-white/75 uppercase">Lead brief</p>
            <span className={cn('inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.15em] uppercase', visualTheme.badgeClass)}>
              {story.domain}
            </span>
          </div>
          <div className="relative space-y-2">
            <p className="text-xs font-semibold tracking-[0.2em] text-white/75 uppercase">Mission focus</p>
            <p className="font-display text-[1.9rem] leading-tight text-white">
              {story.missionTags.slice(0, 2).join(' • ') || 'Defense priorities'}
            </p>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6 md:px-8">
          <StoryMetaRow
            publishedAt={story.publishedAt}
            domain={story.domain}
            sourceBadge={story.sourceBadge}
            track={story.track}
            highImpact={story.highImpact}
          />
          <h2 className="font-display text-3xl leading-[1.1] text-slate-900 sm:text-[2.35rem]">
            <Link href={`/story/${story.slug}`} className="transition-colors hover:text-[var(--brand)]">
              {story.title}
            </Link>
          </h2>
          {story.deck ? <p className="text-muted-foreground max-w-4xl text-base leading-relaxed">{story.deck}</p> : null}

          <div className="grid gap-5 border-y border-slate-200/80 py-5 md:grid-cols-2">
            <section className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.2em] uppercase">Key developments</p>
              <BriefPoints points={story.theNews} maxItems={3} />
            </section>
            <section className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.2em] uppercase">Analyst summary</p>
              <BriefPoints points={blendedInsights} maxItems={3} />
            </section>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-full">
              <Link href={`/story/${story.slug}`}>Read full brief</Link>
            </Button>
            {story.sourceUrl ? (
              <Button asChild variant="outline" className="rounded-full border-slate-300 bg-white">
                <a href={story.sourceUrl} target="_blank" rel="noreferrer">
                  Read source document
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
