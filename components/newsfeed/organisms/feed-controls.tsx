'use client'

import Link from 'next/link'
import {usePathname, useRouter, useSearchParams} from 'next/navigation'

import {SectionKicker} from '@/components/newsfeed/atoms/section-kicker'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {ToggleGroup, ToggleGroupItem} from '@/components/ui/toggle-group'
import {
  briefingTrackLabels,
  briefingTrackValues,
  quickFilterLabels,
  quickFilterValues,
  type BriefingTrack,
  type QuickFilter,
} from '@/lib/defense/constants'

type FeedControlsProps = {
  track: BriefingTrack
  quickFilter: QuickFilter
  isAuthenticated: boolean
}

export function FeedControls({track, quickFilter, isAuthenticated}: FeedControlsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (!value || value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
    }

    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <Card className="border-slate-300/75 bg-white/80 py-0 backdrop-blur">
      <CardContent className="space-y-5 py-5">
        <div className="space-y-2">
          <SectionKicker label="Track" />
          <Tabs value={track} onValueChange={(value) => value && updateParam('track', value)}>
            <TabsList className="w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-slate-200 p-0" variant="line">
              {briefingTrackValues.map((trackValue) => (
                <TabsTrigger
                  key={trackValue}
                  value={trackValue}
                  className="rounded-none border-b-2 border-transparent px-4 py-2 text-[11px] tracking-[0.16em] uppercase data-[state=active]:border-[var(--brand)] data-[state=active]:text-slate-900"
                >
                  {briefingTrackLabels[trackValue]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-2">
          <SectionKicker label="Slice" />
          <ToggleGroup
            type="single"
            value={quickFilter}
            onValueChange={(value) => value && updateParam('filter', value)}
            className="flex w-full flex-wrap gap-2"
            spacing={1}
          >
            {quickFilterValues.map((quickFilterValue) => (
              <ToggleGroupItem
                key={quickFilterValue}
                value={quickFilterValue}
                variant="outline"
                className="rounded-full border-slate-300 bg-white px-4 text-[11px] tracking-[0.13em] uppercase data-[state=on]:border-[var(--brand)] data-[state=on]:bg-[var(--brand-soft)] data-[state=on]:text-slate-900 sm:text-xs"
              >
                {quickFilterLabels[quickFilterValue]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-white to-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <SectionKicker label="Interests" className="text-[var(--brand)]" />
              <p className="text-muted-foreground text-sm">
                {isAuthenticated
                  ? 'Update mission, domain, and tech interests anytime.'
                  : 'Sign in to personalize your ranking and mission radar.'}
              </p>
            </div>
            <Button
              asChild
              size="sm"
              variant={isAuthenticated ? 'outline' : 'default'}
              className={isAuthenticated ? 'rounded-full border-slate-300 bg-white' : 'rounded-full'}
            >
              <Link href={isAuthenticated ? '/settings/interests' : '/auth/sign-in?next=/onboarding'}>
                {isAuthenticated ? 'Manage interests' : 'Sign in'}
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
