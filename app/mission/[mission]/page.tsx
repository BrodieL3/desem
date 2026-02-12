import Link from 'next/link'
import {redirect} from 'next/navigation'

import {StoryList} from '@/components/briefing/story-list'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {slugify, titleFromSlug} from '@/lib/defense/slug'
import {getDefenseStories, storiesByMission} from '@/lib/defense/stories'
import {getUserPersonalizationContext} from '@/lib/user/interests'

type MissionPageProps = {
  params: Promise<{mission: string}>
}

export default async function MissionPage({params}: MissionPageProps) {
  const routeParams = await params

  const [stories, personalization] = await Promise.all([getDefenseStories(), getUserPersonalizationContext()])

  if (personalization.isAuthenticated && !personalization.onboardingCompleted) {
    redirect('/onboarding')
  }

  const missionCandidates = Array.from(new Set(stories.flatMap((story) => story.missionTags)))
  const matchedMission = missionCandidates.find((mission) => slugify(mission) === routeParams.mission)

  const missionName = matchedMission ?? titleFromSlug(routeParams.mission)
  const missionStories = storiesByMission(stories, missionName)

  const domainSet = Array.from(new Set(missionStories.map((story) => story.domain)))
  const horizonSet = Array.from(new Set(missionStories.map((story) => story.horizon).filter(Boolean)))
  const stageSet = Array.from(new Set(missionStories.map((story) => story.acquisitionStatus).filter(Boolean)))

  return (
    <main className="min-h-screen px-3 py-4 md:px-6 md:py-7">
      <div className="editorial-shell mx-auto flex max-w-[1320px] flex-col gap-5 px-4 py-6 md:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="rounded-full border-slate-300 bg-white">
            <Link href="/">Back to today</Link>
          </Button>
        </div>

        <Card className="border-slate-300/70 bg-white/90">
          <CardHeader>
            <CardTitle className="font-display text-4xl leading-tight">Mission: {missionName}</CardTitle>
            <CardDescription>
              Mission timeline and blended analysis with optional station drill-down.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {domainSet.map((domain) => (
                <Badge key={`domain-${domain}`} variant="secondary" className="border-slate-300 bg-slate-100/70">
                  Domain: {domain}
                </Badge>
              ))}
              {horizonSet.map((horizon) => (
                <Badge key={`horizon-${horizon}`} variant="outline" className="border-slate-300 bg-white">
                  Horizon: {horizon}
                </Badge>
              ))}
              {stageSet.map((stage) => (
                <Badge key={`stage-${stage}`} variant="outline" className="border-slate-300 bg-white">
                  Stage: {stage}
                </Badge>
              ))}
            </div>
            {personalization.isAuthenticated ? (
              <p className="text-muted-foreground text-sm">Your saved interests are active on the home feed ranking.</p>
            ) : (
              <p className="text-muted-foreground text-sm">Sign in to personalize ranking across mission feeds.</p>
            )}
          </CardContent>
        </Card>

        <StoryList
          title={`${missionName} stories`}
          description="Chronological Semaform cards tagged to this mission."
          stories={missionStories}
        />
      </div>
    </main>
  )
}
