import {DefenseStoryCard} from '@/components/briefing/defense-story-card'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {DefenseSemaformStory} from '@/lib/defense/types'

type StoryListProps = {
  title: string
  description: string
  stories: DefenseSemaformStory[]
  limit?: number
}

export function StoryList({title, description, stories, limit}: StoryListProps) {
  const visibleStories = typeof limit === 'number' ? stories.slice(0, limit) : stories

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-3xl leading-tight">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      {visibleStories.length === 0 ? (
        <Card className="border-slate-300/70 bg-white/90">
          <CardHeader>
            <CardTitle className="text-base">No stories in this slice yet</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Change filter settings or populate additional defense stories in Studio.
          </CardContent>
        </Card>
      ) : (
        visibleStories.map((story) => <DefenseStoryCard key={story.id} story={story} />)
      )}
    </section>
  )
}
