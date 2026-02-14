import type {CuratedRail} from '@/lib/editorial/ui-types'

import {StoryCard} from './story-card'

type RailSectionProps = {
  rail: CuratedRail
}

function toRailHeadingId(topicLabel: string) {
  const normalized = topicLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `rail-${normalized || 'general-defense'}`
}

export function RailSection({rail}: RailSectionProps) {
  const headingId = toRailHeadingId(rail.topicLabel)

  return (
    <section className="space-y-4 border-t border-border pt-6" aria-labelledby={headingId}>
      <div className="flex items-end justify-between gap-3">
        <h2 id={headingId} className="font-display text-[2.2rem] leading-tight text-foreground">
          {rail.topicLabel}
        </h2>
        <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase">{rail.stories.length} stories</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rail.stories.map((card) => (
          <StoryCard key={card.clusterKey} card={card} />
        ))}
      </div>
    </section>
  )
}
