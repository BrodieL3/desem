import Link from 'next/link'

import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'

export default function BriefingsPage() {
  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[1100px] p-5 md:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">Field Brief</p>
            <h1 className="font-display text-4xl leading-tight">Briefings</h1>
            <p className="text-muted-foreground mt-1 text-base">Policy and institutional briefings will be surfaced here.</p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/">Back to front page</Link>
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-3xl leading-tight">Coming soon</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-base">
            This route is reserved for curated policy briefings in the next phase.
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
