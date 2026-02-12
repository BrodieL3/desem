import {redirect} from 'next/navigation'

import {InterestsEditor} from '@/components/user/interests-editor'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {deriveInterestFacetOptions, getDefenseStories} from '@/lib/defense/stories'
import {getUserPersonalizationContext} from '@/lib/user/interests'

function resolveNextPath(value: string | undefined) {
  if (!value || !value.startsWith('/')) {
    return '/'
  }

  return value
}

type OnboardingPageProps = {
  searchParams?: Promise<{next?: string}>
}

export default async function OnboardingPage({searchParams}: OnboardingPageProps) {
  const params = searchParams ? await searchParams : undefined
  const nextPath = resolveNextPath(params?.next)

  const personalization = await getUserPersonalizationContext()

  if (!personalization.isAuthenticated) {
    redirect('/auth/sign-in?next=/onboarding')
  }

  if (personalization.onboardingCompleted) {
    redirect(nextPath === '/onboarding' ? '/' : nextPath)
  }

  const stories = await getDefenseStories()
  const facets = deriveInterestFacetOptions(stories)
  const postOnboardingPath = nextPath === '/onboarding' ? '/' : nextPath

  return (
    <main className="min-h-screen px-3 py-4 md:px-6 md:py-7">
      <div className="editorial-shell mx-auto w-full max-w-4xl px-4 py-8 md:px-6 lg:px-8">
        <Card className="mb-4 border-slate-300/70 bg-white/90">
          <CardHeader>
            <CardTitle className="font-display text-4xl leading-tight">Set your interests</CardTitle>
            <CardDescription>
              Choose mission, domain, and technology interests to personalize the feed ranking.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Ranking weights for launch: mission x3, domain x2, tech x1, plus high-impact bonus.
          </CardContent>
        </Card>

        <InterestsEditor
          mode="onboarding"
          options={facets}
          initialInterests={personalization.interests}
          nextPath={postOnboardingPath}
        />
      </div>
    </main>
  )
}
