import Link from 'next/link'
import {redirect} from 'next/navigation'

import {SectionKicker} from '@/components/newsfeed/atoms/section-kicker'
import {FeedControls} from '@/components/newsfeed/organisms/feed-controls'
import {HeroStory} from '@/components/newsfeed/organisms/hero-story'
import {LiveWire} from '@/components/newsfeed/organisms/live-wire'
import {NewsRadar} from '@/components/newsfeed/organisms/news-radar'
import {StoryStream} from '@/components/newsfeed/organisms/story-stream'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {briefingTrackLabels, type BriefingTrack} from '@/lib/defense/constants'
import {
  filterStoriesForFeed,
  getDefenseStories,
  getSignals,
  getTopMissionTags,
  groupStoriesByTrack,
  normalizeFeedParams,
  rankStoriesForFeed,
  resolveMissionInterests,
} from '@/lib/defense/stories'
import {getRecentIngestedArticles, rankIngestedArticlesForFeed} from '@/lib/ingest/recent-articles'
import {getUserPersonalizationContext} from '@/lib/user/interests'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

type HomePageProps = {
  searchParams?: Promise<{station?: string; track?: string; filter?: string}>
}

const trackSections: Record<Exclude<BriefingTrack, 'all'>, {title: string; description: string}> = {
  macro: {
    title: 'Geopolitics and force posture',
    description: 'Conflict-level moves, alliance posture, and strategic policy shifts.',
  },
  programs: {
    title: 'Programs and contracts',
    description: 'RFP movement, awards, timelines, and execution signals by mission set.',
  },
  tech: {
    title: 'Defense technology',
    description: 'Software, autonomy, and integration shifts shaping near-term capability.',
  },
  capital: {
    title: 'Capital and market moves',
    description: 'Fundraising, investor posture, and demand durability indicators.',
  },
}

export default async function Home({searchParams}: HomePageProps) {
  const params = searchParams ? await searchParams : undefined

  const [stories, personalization, ingestedArticles] = await Promise.all([
    getDefenseStories(),
    getUserPersonalizationContext(),
    getRecentIngestedArticles(80),
  ])

  if (personalization.isAuthenticated && !personalization.onboardingCompleted) {
    redirect('/onboarding')
  }

  const normalizedParams = normalizeFeedParams(params)
  const missionInterests = resolveMissionInterests(personalization.interests)

  const filteredStories = filterStoriesForFeed(stories, {
    track: normalizedParams.track,
    quickFilter: normalizedParams.filter,
    myMissions: missionInterests,
  })

  const feedStories = rankStoriesForFeed(filteredStories, personalization.interests)
  const groupedStories = groupStoriesByTrack(feedStories)

  const sectionKeys: Array<Exclude<BriefingTrack, 'all'>> =
    normalizedParams.track === 'all' ? ['macro', 'programs', 'tech', 'capital'] : [normalizedParams.track]

  const visibleStoryCount = sectionKeys.reduce((count, key) => count + Math.min(groupedStories[key].length, 3), 0)
  const estimatedMinutes = Math.min(5, Math.max(3, Math.ceil((visibleStoryCount * 35) / 60)))
  const now = dateFormatter.format(new Date())
  const signals = getSignals(feedStories)
  const leadStory = feedStories[0] ?? stories[0]
  const missionRadar = missionInterests.length > 0 ? missionInterests : getTopMissionTags(feedStories.length > 0 ? feedStories : stories)
  const rankedIngestedArticles = rankIngestedArticlesForFeed(ingestedArticles, personalization.interests).slice(0, 12)

  return (
    <main className="min-h-screen px-3 py-4 md:px-6 md:py-7">
      <div className="editorial-shell animate-rise mx-auto max-w-[1420px] overflow-hidden">
        <header className="space-y-6 border-b border-slate-300/80 px-4 py-6 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <SectionKicker label="Defense desk" className="text-[var(--brand)]" />
              <h1 className="font-display text-4xl leading-none text-slate-900 sm:text-[3.2rem]">Field Brief</h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                An editorial-style defense briefing surface inspired by the modern publication desk.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">{now}</p>
              {personalization.isAuthenticated ? (
                <Button asChild size="sm" variant="outline" className="rounded-full border-slate-300 bg-white">
                  <Link href="/auth/sign-out">Sign out</Link>
                </Button>
              ) : (
                <Button asChild size="sm" className="rounded-full">
                  <Link href="/auth/sign-in?next=/">Sign in</Link>
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm" className="rounded-full border border-transparent bg-slate-900 text-white">
              <Link href="/">Top stories</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full border-slate-300 bg-white">
              <Link href="/?track=macro">Geopolitics</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full border-slate-300 bg-white">
              <Link href="/?track=programs">Contracts</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full border-slate-300 bg-white">
              <Link href="/?track=tech">Technology</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full border-slate-300 bg-white">
              <Link href="/?track=capital">Capital</Link>
            </Button>
          </div>

          <Card className="border-slate-300/70 bg-white/90 py-0 shadow-none">
            <CardContent className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <p className="font-display text-[1.7rem] leading-tight text-slate-900 sm:text-3xl">
                Craft concise <span className="text-[var(--brand)]">analysis</span> at the pace of the daily desk.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={personalization.isAuthenticated ? 'secondary' : 'outline'}
                  className="rounded-full border-slate-300 bg-white px-3 py-1 text-[11px] tracking-[0.15em] uppercase"
                >
                  {personalization.isAuthenticated ? 'Personalized' : 'Public view'}
                </Badge>
                <span className="text-muted-foreground text-xs">{estimatedMinutes} min read</span>
              </div>
            </CardContent>
          </Card>

          <FeedControls
            track={normalizedParams.track}
            quickFilter={normalizedParams.filter}
            isAuthenticated={personalization.isAuthenticated}
          />
        </header>

        <div className="grid gap-7 px-4 py-7 md:px-8 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-10">
            {leadStory ? <HeroStory story={leadStory} /> : null}
            <LiveWire isAuthenticated={personalization.isAuthenticated} articles={rankedIngestedArticles} />

            <section className="space-y-8">
              {sectionKeys.map((sectionKey) => {
                const sectionMeta = trackSections[sectionKey]
                const sectionStories =
                  leadStory && normalizedParams.track === 'all'
                    ? groupedStories[sectionKey].filter((story) => story.id !== leadStory.id)
                    : groupedStories[sectionKey]

                return (
                  <div key={sectionKey} className="space-y-4 border-t border-slate-200/80 pt-7 first:border-0 first:pt-0">
                    <StoryStream
                      title={sectionMeta.title}
                      description={sectionMeta.description}
                      stories={sectionStories}
                      limit={normalizedParams.track === 'all' ? 3 : undefined}
                    />

                    {normalizedParams.track === 'all' && sectionStories.length > 3 ? (
                      <Button asChild variant="outline" size="sm" className="rounded-full border-slate-300 bg-white">
                        <Link href={`/?track=${sectionKey}`}>
                          View all {briefingTrackLabels[sectionKey].toLowerCase()}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                )
              })}
            </section>
          </div>

          <NewsRadar
            isAuthenticated={personalization.isAuthenticated}
            interests={personalization.interests}
            missionRadar={missionRadar}
            stories={feedStories}
            signals={signals}
          />
        </div>

        <footer className="border-t border-slate-300/75 px-4 py-6 md:px-8">
          <Card className="border-slate-300/75 bg-gradient-to-r from-white via-white to-slate-50 py-0">
            <CardHeader className="gap-1">
              <SectionKicker label="Briefing note" />
              <CardTitle className="font-display text-3xl leading-tight text-slate-900">
                Follow the signal, skip the noise.
              </CardTitle>
              <CardDescription>
                Track: {briefingTrackLabels[normalizedParams.track]} | Slice: {normalizedParams.filter.replace('-', ' ')} |
                Model: mission &gt; domain &gt; tech
              </CardDescription>
            </CardHeader>
          </Card>
        </footer>
      </div>
    </main>
  )
}
