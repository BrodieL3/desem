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
      <section className="space-y-3">
        <p className="text-muted-foreground text-base">No narrative content is available for this story yet.</p>
      </section>
    )
  }

  const visibleBlocks = expanded ? blocks : blocks.slice(0, 1)

  return (
    <section className="space-y-5">
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

      {blocks.length > 1 && !expanded ? (
        <Button type="button" variant="secondary" onClick={() => setExpanded(true)}>
          Read more
        </Button>
      ) : null}
    </section>
  )
}
