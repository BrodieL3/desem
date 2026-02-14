'use client'

import Link from 'next/link'

import {Button} from '@/components/ui/button'
import {Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger} from '@/components/ui/sheet'

import type {PrimeSourcesDrawerProps} from './types'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function formatDate(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return dateFormatter.format(parsed)
}

export function SourcesDrawer({sources}: PrimeSourcesDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          View sources ({sources.length})
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[calc(100vw-1rem)] sm:w-[560px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle className="font-display text-3xl leading-tight">Filing sources</SheetTitle>
          <SheetDescription>
            Official filing and release references used to populate this module. Values are shown as not disclosed when metrics are absent in source materials.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-3 overflow-y-auto pr-1">
          {sources.length === 0 ? (
            <p className="text-muted-foreground text-sm">No filing sources are available yet.</p>
          ) : (
            sources.map((source) => (
              <article key={source.id} className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">
                  {source.filingType} · {formatDate(source.filingDate)}
                </p>
                <Link
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open source document
                </Link>
              </article>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
