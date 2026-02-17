'use client'

import {useState} from 'react'

import {Button} from '@/components/ui/button'
import type {StoryFeedBlock} from '@/lib/editorial/ui-types'

type StoryNewsFeedProps = {
  blocks: StoryFeedBlock[]
}

function paragraphize(text: string) {
  const explicitParagraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (explicitParagraphs.length >= 2) {
    return explicitParagraphs
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  if (sentences.length === 0) {
    const fallback = text.trim()
    return fallback ? [fallback] : []
  }

  const paragraphs: string[] = []

  for (let index = 0; index < sentences.length; index += 3) {
    paragraphs.push(sentences.slice(index, index + 3).join(' '))
  }

  return paragraphs
}

export function StoryNewsFeed({blocks}: StoryNewsFeedProps) {
  const [expanded, setExpanded] = useState(false)

  if (blocks.length === 0) {
    return (
      <section className="space-y-3" aria-labelledby="story-feed-heading">
        <h2 id="story-feed-heading" className="text-xs tracking-[0.12em] uppercase text-muted-foreground">
          Briefing summary
        </h2>
        <p className="text-muted-foreground text-base">No narrative content is available for this story yet.</p>
      </section>
    )
  }

  const visibleBlocks = expanded ? blocks : blocks.slice(0, 1)

  return (
    <section className="space-y-5" aria-labelledby="story-feed-heading">
      <h2 id="story-feed-heading" className="border-b border-border pb-4 text-xs tracking-[0.12em] uppercase text-muted-foreground">
        Briefing summary
      </h2>

      <div className="story-prose">
        {visibleBlocks.map((block) => {
          const paragraphs = paragraphize(block.body)
          const visibleParagraphs = expanded ? paragraphs : paragraphs.slice(0, 2)

          return (
            <section key={block.id} className="story-prose-section">
              {block.imageUrl ? (
                <figure className="mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={block.imageUrl}
                    alt={block.imageAlt ?? 'Story image'}
                    className="story-inline-image"
                    loading="lazy"
                  />
                </figure>
              ) : null}
              {visibleParagraphs.map((paragraph, paragraphIndex) => (
                <p key={`${block.id}-${paragraphIndex}`}>{paragraph}</p>
              ))}
            </section>
          )
        })}
      </div>

      {blocks.length > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <p className="text-muted-foreground text-sm">
            {expanded ? `Showing all ${blocks.length} briefing sections.` : `Showing 1 of ${blocks.length} briefing sections.`}
          </p>
          <Button type="button" variant="secondary" onClick={() => setExpanded((current) => !current)}>
            {expanded ? 'Show less' : 'Read full briefing'}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
