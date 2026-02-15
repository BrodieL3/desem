'use client'

import {BackToFrontPageButton} from '@/components/back-to-front-page-button'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'

type StoryErrorPageProps = {
  reset: () => void
}

export default function StoryErrorPage({reset}: StoryErrorPageProps) {
  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[760px] p-5 md:p-8">
        <div className="mb-5">
          <BackToFrontPageButton />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-3xl leading-tight">Story unavailable right now</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-base">
              We could not load this story briefing. Try again, or return to the front page.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={reset}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
