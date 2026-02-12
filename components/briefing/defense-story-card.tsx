'use client'

import Link from 'next/link'

import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from '@/components/ui/accordion'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Separator} from '@/components/ui/separator'
import {StationBullets} from '@/components/briefing/station-bullets'
import {TagRow} from '@/components/briefing/tag-row'
import type {DefenseSemaformStory} from '@/lib/defense/types'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function notableSourceLabel(source?: string) {
  if (source === 'secondary') {
    return 'Secondary'
  }

  if (source === 'deep_dive') {
    return 'Deep dive'
  }

  if (source === 'critique') {
    return 'Critique'
  }

  return 'Primary'
}

type DefenseStoryCardProps = {
  story: DefenseSemaformStory
  compact?: boolean
}

export function DefenseStoryCard({story, compact = false}: DefenseStoryCardProps) {
  const cardPadding = compact ? 'px-4' : ''

  return (
    <Card className={compact ? 'gap-4 border-slate-300/70 bg-white/90 py-4' : 'border-slate-300/70 bg-white/90'}>
      <CardHeader className={cardPadding}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="font-display text-4xl leading-[1.05]">
              <Link href={`/story/${story.slug}`} className="transition-colors hover:text-[var(--brand)]">
                {story.title}
              </Link>
            </CardTitle>
            {story.deck ? <CardDescription className="max-w-3xl text-sm leading-relaxed">{story.deck}</CardDescription> : null}
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge className="border-slate-300 bg-white">{story.sourceBadge}</Badge>
            <p className="text-muted-foreground text-xs">{dateFormatter.format(new Date(story.publishedAt))}</p>
            {story.sourceUrl ? (
              <Button asChild size="sm" variant="outline" className="rounded-full border-slate-300 bg-white">
                <a href={story.sourceUrl} target="_blank" rel="noreferrer">
                  Primary doc
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <TagRow story={story} />
      </CardHeader>

      <CardContent className={`space-y-5 ${cardPadding}`.trim()}>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">The News</h3>
          <ul className="space-y-2">
            {story.theNews.map((item) => (
              <li key={item} className="rounded-md border p-3 text-sm leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <Separator />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Analyst&apos;s View</h3>
            <Badge variant="secondary" className="border-slate-300 bg-slate-100/70">
              Blended + station drill-down
            </Badge>
          </div>
          <StationBullets analystView={story.analystView} />
        </section>

        <Separator className="md:hidden" />

        <section className="md:hidden">
          <Accordion type="multiple">
            <AccordionItem value="disagreement">
              <AccordionTrigger>Room for Disagreement</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {story.roomForDisagreement.map((item) => (
                    <li key={item} className="bg-muted rounded-md p-3 text-sm leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="view-from">
              <AccordionTrigger>View From</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {story.viewFrom.map((item) => (
                    <div key={`${item.perspective}:${item.note}`} className="bg-muted rounded-md p-3 text-sm leading-relaxed">
                      <p className="font-medium">{item.perspective}</p>
                      <p className="text-muted-foreground mt-1">{item.note}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <section className="hidden gap-4 md:grid md:grid-cols-2">
          <Card className="gap-3 border-slate-300/70 bg-white py-4">
            <CardHeader className="px-4 pb-0">
              <CardTitle className="text-sm">Room for Disagreement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4">
              {story.roomForDisagreement.map((item) => (
                <p key={item} className="bg-muted rounded-md p-3 text-sm leading-relaxed">
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card className="gap-3 border-slate-300/70 bg-white py-4">
            <CardHeader className="px-4 pb-0">
              <CardTitle className="text-sm">View From</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4">
              {story.viewFrom.map((item) => (
                <div key={`${item.perspective}:${item.note}`} className="bg-muted rounded-md p-3 text-sm leading-relaxed">
                  <p className="font-medium">{item.perspective}</p>
                  <p className="text-muted-foreground mt-1">{item.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Notable</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {story.notableLinks.map((link) => (
              <Button
                key={`${link.url}:${link.label}`}
                asChild
                variant="outline"
                className="h-auto justify-start rounded-xl border-slate-300 bg-white py-3 text-left"
              >
                <a href={link.url} target="_blank" rel="noreferrer">
                  <span className="font-medium">{link.label}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{notableSourceLabel(link.source)}</span>
                </a>
              </Button>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
