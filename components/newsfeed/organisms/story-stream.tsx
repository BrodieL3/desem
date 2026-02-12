import {SectionKicker} from '@/components/newsfeed/atoms/section-kicker'
import {StoryRow} from '@/components/newsfeed/molecules/story-row'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {DefenseSemaformStory} from '@/lib/defense/types'

type StoryStreamProps = {
  title: string
  description: string
  stories: DefenseSemaformStory[]
  limit?: number
}

export function StoryStream({title, description, stories, limit}: StoryStreamProps) {
  const visibleStories = typeof limit === 'number' ? stories.slice(0, limit) : stories

  if (visibleStories.length === 0) {
    return (
      <Card className="border-slate-300/70 bg-white/85">
        <CardHeader>
          <CardTitle className="font-display text-2xl">No stories in this stream yet</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Expand the selected filters or add more stories in Studio.
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <SectionKicker label="News stream" />
          <h2 className="font-display text-[1.9rem] leading-tight text-slate-900">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.22em] uppercase">
          {visibleStories.length} stories
        </p>
      </div>
      <div className="animate-stagger space-y-3">
        {visibleStories.map((story) => (
          <StoryRow key={story.id} story={story} />
        ))}
      </div>
    </section>
  )
}
