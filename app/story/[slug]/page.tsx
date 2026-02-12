import Link from 'next/link'
import {notFound, redirect} from 'next/navigation'

import {DefenseStoryCard} from '@/components/briefing/defense-story-card'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {slugify} from '@/lib/defense/slug'
import {findStoryBySlug, getDefenseStories} from '@/lib/defense/stories'
import {getUserPersonalizationContext} from '@/lib/user/interests'

type StoryPageProps = {
  params: Promise<{slug: string}>
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default async function StoryPage({params}: StoryPageProps) {
  const routeParams = await params

  const [stories, personalization] = await Promise.all([getDefenseStories(), getUserPersonalizationContext()])

  if (personalization.isAuthenticated && !personalization.onboardingCompleted) {
    redirect('/onboarding')
  }

  const story = findStoryBySlug(stories, routeParams.slug)
  if (!story) {
    notFound()
  }

  const relatedStories = stories
    .filter(
      (candidate) =>
        candidate.id !== story.id && candidate.missionTags.some((mission) => story.missionTags.includes(mission))
    )
    .slice(0, 4)

  const timelineStories = stories
    .filter((candidate) => candidate.missionTags.some((mission) => story.missionTags.includes(mission)))
    .slice(0, 6)

  return (
    <main className="min-h-screen px-3 py-4 md:px-6 md:py-7">
      <div className="editorial-shell mx-auto flex max-w-[1320px] flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline" className="rounded-full border-slate-300 bg-white">
            <Link href="/">Back to today</Link>
          </Button>

          {story.missionTags.slice(0, 2).map((mission) => (
            <Button key={mission} asChild size="sm" variant="ghost" className="rounded-full">
              <Link href={`/mission/${slugify(mission)}`}>{mission}</Link>
            </Button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <DefenseStoryCard story={story} />

          <aside className="space-y-4">
            <Card className="border-slate-300/70 bg-white/90">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Related stories</CardTitle>
                <CardDescription>Same mission or program cluster.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {relatedStories.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No related stories yet.</p>
                ) : (
                  relatedStories.map((item) => (
                    <Button
                      key={item.id}
                      asChild
                      variant="outline"
                      className="h-auto w-full justify-start rounded-xl border-slate-300 bg-white py-3 text-left"
                    >
                      <Link href={`/story/${item.slug}`}>{item.title}</Link>
                    </Button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-300/70 bg-white/90">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Program timeline</CardTitle>
                <CardDescription>Recent events across this mission set.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {timelineStories.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-300/75 bg-white p-3 text-sm">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{dateFormatter.format(new Date(item.publishedAt))}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-300/70 bg-white/90">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Reader context</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                {personalization.isAuthenticated
                  ? 'Personalized ranking active from your saved interests.'
                  : 'Sign in to personalize ranking by mission, domain, and tech.'}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}
