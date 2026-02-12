import Link from 'next/link'

import {StoryMetaRow} from '@/components/newsfeed/molecules/story-meta-row'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {getBlendedAnalystBullets} from '@/lib/defense/stories'
import {getDomainVisualTheme, getTrackAccentClass} from '@/lib/defense/story-theme'
import type {DefenseSemaformStory} from '@/lib/defense/types'
import {cn} from '@/lib/utils'

type StoryRowProps = {
  story: DefenseSemaformStory
}

export function StoryRow({story}: StoryRowProps) {
  const blendedInsight = getBlendedAnalystBullets(story, 1)[0]
  const visualTheme = getDomainVisualTheme(story.domain)

  return (
    <Card className="group animate-rise gap-0 overflow-hidden border-slate-300/80 bg-white/85 py-0 shadow-[0_18px_35px_-30px_rgba(15,23,42,0.55)] transition-transform duration-200 hover:-translate-y-0.5">
      <CardContent className="grid gap-0 p-0 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className={cn('relative isolate flex min-h-[170px] flex-col justify-between overflow-hidden px-4 py-4', `bg-gradient-to-br ${visualTheme.gradientClass}`)}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,rgba(255,255,255,0.2)_50%,transparent_70%)] opacity-80" />
          <p className="relative text-[11px] font-semibold tracking-[0.2em] text-white/75 uppercase">{story.track}</p>
          <div className="relative space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-white/70 uppercase">Mission tags</p>
            <p className="font-display text-xl leading-tight text-white">{story.missionTags.slice(0, 2).join(' • ') || 'Briefing'}</p>
          </div>
        </div>

        <div className={cn('space-y-3 border-l-4 px-5 py-4 md:px-6', getTrackAccentClass(story.track))}>
          <StoryMetaRow
            publishedAt={story.publishedAt}
            domain={story.domain}
            sourceBadge={story.sourceBadge}
            track={story.track}
            highImpact={story.highImpact}
          />
          <h3 className="font-display text-2xl leading-tight text-slate-900">
            <Link href={`/story/${story.slug}`} className="transition-colors hover:text-[var(--brand)]">
              {story.title}
            </Link>
          </h3>
          {story.deck ? <p className="text-muted-foreground text-sm leading-relaxed">{story.deck}</p> : null}
          {blendedInsight ? (
            <p className="text-sm leading-relaxed">
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase">Why this matters</span>
              <span className="mx-2 text-slate-300">/</span>
              {blendedInsight}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" variant="outline" className="rounded-full border-slate-300 bg-white">
              <Link href={`/story/${story.slug}`}>Full analysis</Link>
            </Button>
            {story.sourceUrl ? (
              <Button asChild size="sm" variant="ghost" className="rounded-full">
                <a href={story.sourceUrl} target="_blank" rel="noreferrer">
                  Source
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
