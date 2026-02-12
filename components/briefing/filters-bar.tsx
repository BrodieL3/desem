'use client'

import {usePathname, useRouter, useSearchParams} from 'next/navigation'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {ToggleGroup, ToggleGroupItem} from '@/components/ui/toggle-group'
import {
  briefingTrackLabels,
  briefingTrackValues,
  quickFilterLabels,
  quickFilterValues,
  type BriefingTrack,
  type QuickFilter,
} from '@/lib/defense/constants'

type FiltersBarProps = {
  track: BriefingTrack
  quickFilter: QuickFilter
}

export function FiltersBar({track, quickFilter}: FiltersBarProps) {
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Today&apos;s defense brief (3-5 minutes)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">Track</p>
          <ToggleGroup type="single" value={track} onValueChange={(value) => value && updateParam('track', value)}>
            {briefingTrackValues.map((trackValue) => (
              <ToggleGroupItem key={trackValue} value={trackValue}>
                {briefingTrackLabels[trackValue]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">Quick filter</p>
          <ToggleGroup type="single" value={quickFilter} onValueChange={(value) => value && updateParam('filter', value)}>
            {quickFilterValues.map((quickFilterValue) => (
              <ToggleGroupItem key={quickFilterValue} value={quickFilterValue}>
                {quickFilterLabels[quickFilterValue]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardContent>
    </Card>
  )
}
