import Link from 'next/link'

import {SectionKicker} from '@/components/newsfeed/atoms/section-kicker'
import {SignalPill} from '@/components/newsfeed/atoms/signal-pill'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {ScrollArea} from '@/components/ui/scroll-area'
import {slugify} from '@/lib/defense/slug'
import type {DefenseSemaformStory} from '@/lib/defense/types'
import type {UserInterestCollection} from '@/lib/user/types'

type NewsRadarProps = {
  isAuthenticated: boolean
  interests: UserInterestCollection
  missionRadar: string[]
  stories: DefenseSemaformStory[]
  signals: DefenseSemaformStory[]
}

export function NewsRadar({isAuthenticated, interests, missionRadar, stories, signals}: NewsRadarProps) {
  const personalizedCount = interests.mission.length + interests.domain.length + interests.tech.length

  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      <Card className="border-slate-300/75 bg-white/85 py-5">
        <CardHeader className="space-y-1">
          <SectionKicker label="Your interests" />
          <CardTitle className="font-display text-2xl leading-tight">
            {isAuthenticated ? `${personalizedCount} interests active` : 'Sign in for personalization'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAuthenticated ? (
            <>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Mission</p>
                <div className="flex flex-wrap gap-2">
                  {interests.mission.length === 0 ? (
                    <SignalPill label="None selected" tone="muted" />
                  ) : (
                    interests.mission
                      .slice(0, 4)
                      .map((mission) => <SignalPill key={mission} label={mission} tone="muted" className="border-slate-200" />)
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Domain + tech</p>
                <div className="flex flex-wrap gap-2">
                  {[...interests.domain, ...interests.tech].slice(0, 5).map((value) => (
                    <SignalPill key={value} label={value} tone="muted" className="border-slate-200" />
                  ))}
                </div>
              </div>
              <Button asChild variant="outline" className="w-full rounded-full border-slate-300 bg-white">
                <Link href="/settings/interests">Edit interests</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                Add mission, domain, and tech interests to personalize feed ranking.
              </p>
              <Button asChild className="w-full rounded-full">
                <Link href="/auth/sign-in?next=/onboarding">Sign in</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-300/75 bg-white/85 py-5">
        <CardHeader>
          <CardTitle className="font-display text-2xl leading-tight">Mission radar</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-56 pr-3">
            <div className="space-y-2">
              {missionRadar.map((mission) => {
                const count = stories.filter((story) => story.missionTags.includes(mission)).length
                return (
                  <Button
                    key={mission}
                    asChild
                    variant="outline"
                    className="h-auto w-full justify-between rounded-xl border-slate-300 bg-white py-3"
                  >
                    <Link href={`/mission/${slugify(mission)}`}>
                      <span>{mission}</span>
                      <span className="text-muted-foreground text-[11px] tracking-[0.08em] uppercase">{count}</span>
                    </Link>
                  </Button>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-slate-300/75 bg-white/85 py-5">
        <CardHeader>
          <CardTitle className="font-display text-2xl leading-tight">Signal wire</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {signals.length === 0 ? (
            <p className="text-muted-foreground text-sm">No low-latency signals in this slice.</p>
          ) : (
            signals.map((signal) => (
              <Button
                key={signal.id}
                asChild
                variant="ghost"
                className="h-auto w-full justify-start rounded-xl px-3 py-2 text-left hover:bg-slate-100"
              >
                <Link href={`/story/${signal.slug}`}>{signal.title}</Link>
              </Button>
            ))
          )}
        </CardContent>
      </Card>
    </aside>
  )
}
