'use client'

import Link from 'next/link'

import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from '@/components/ui/accordion'
import type {CuratedHomeForYouTopic} from '@/lib/editorial/ui-types'

type RightRailTopicsProps = {
  topics: CuratedHomeForYouTopic[]
  previewCount?: number
}

function topicPreviewLabel(topics: CuratedHomeForYouTopic[], previewCount: number) {
  const previewTopics = topics.slice(0, previewCount)
  const previewText = previewTopics.map((topic) => topic.label).join(' · ')
  const remaining = Math.max(0, topics.length - previewTopics.length)

  if (remaining === 0) {
    return previewText
  }

  return `${previewText} +${remaining}`
}

export function RightRailTopics({topics, previewCount = 3}: RightRailTopicsProps) {
  if (topics.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="for-you-topics-heading">
      <Accordion type="single" collapsible>
        <AccordionItem value="for-you-topics" className="border-b-0">
          <AccordionTrigger className="px-1 py-3 text-left hover:no-underline">
            <span className="space-y-1">
              <span id="for-you-topics-heading" className="block text-xs tracking-[0.16em] uppercase text-muted-foreground">
                Topics
              </span>
              <span className="text-muted-foreground block text-sm leading-relaxed">{topicPreviewLabel(topics, previewCount)}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pt-0">
            <div className="news-divider-list news-divider-list-no-top">
              {topics.map((topic) => (
                <div key={topic.id} className="news-divider-item news-divider-item-compact flex min-h-11 items-center justify-between gap-2 px-1">
                  <Link href={`/topics/${topic.slug}`} className="text-sm font-medium hover:text-primary">
                    {topic.label}
                  </Link>
                  <span className="text-muted-foreground text-xs">{topic.articleCount}</span>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  )
}
