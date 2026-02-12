import Link from 'next/link'
import {redirect} from 'next/navigation'

import {InterestsEditor} from '@/components/user/interests-editor'
import {Button} from '@/components/ui/button'
import {Card, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {deriveInterestFacetOptions, getDefenseStories} from '@/lib/defense/stories'
import {getUserPersonalizationContext} from '@/lib/user/interests'

export default async function InterestSettingsPage() {
  const personalization = await getUserPersonalizationContext()

  if (!personalization.isAuthenticated) {
    redirect('/auth/sign-in?next=/settings/interests')
  }

  if (!personalization.onboardingCompleted) {
    redirect('/onboarding?next=/settings/interests')
  }

  const stories = await getDefenseStories()
  const facets = deriveInterestFacetOptions(stories)

  return (
    <main className="min-h-screen px-3 py-4 md:px-6 md:py-7">
      <div className="editorial-shell mx-auto w-full max-w-4xl space-y-4 px-4 py-8 md:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full border-slate-300 bg-white">
            <Link href="/">Back to feed</Link>
          </Button>
        </div>

        <Card className="border-slate-300/70 bg-white/90">
          <CardHeader>
            <CardTitle className="font-display text-4xl leading-tight">Interest settings</CardTitle>
            <CardDescription>
              Update missions, domains, and technologies to retune your personalized ranking.
            </CardDescription>
          </CardHeader>
        </Card>

        <InterestsEditor mode="settings" options={facets} initialInterests={personalization.interests} />
      </div>
    </main>
  )
}
