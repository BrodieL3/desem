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
  if (blocks.length === 0) {
    return (
      <section className="space-y-3" aria-labelledby="story-feed-heading">
        <h2 id="story-feed-heading" className="font-display text-[2.2rem] leading-tight text-foreground">
          Full briefing
        </h2>
        <p className="text-muted-foreground text-base">No narrative content is available for this story yet.</p>
      </section>
    )
  }

  return (
    <section className="space-y-5" aria-labelledby="story-feed-heading">
      <h2 id="story-feed-heading" className="border-b border-border pb-4 font-display text-[2.2rem] leading-tight text-foreground">
        Full briefing
      </h2>

      <div className="story-prose">
        {blocks.map((block) => {
          const paragraphs = paragraphize(block.body)

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
              {paragraphs.map((paragraph, paragraphIndex) => (
                <p key={`${block.id}-${paragraphIndex}`}>{paragraph}</p>
              ))}
            </section>
          )
        })}
      </div>
    </section>
  )
}
