import type {CuratedStoryDetail} from '@/lib/editorial/ui-types'

type StoryBriefingHeaderProps = {
  detail: CuratedStoryDetail
}

function compactText(value: string, maxChars: number) {
  const normalized = value.trim().replace(/\s+/g, ' ')

  if (normalized.length <= maxChars) {
    return normalized
  }

  const slice = normalized.slice(0, maxChars + 1)
  const breakIndex = slice.lastIndexOf(' ')
  const bounded = breakIndex > Math.floor(maxChars * 0.6) ? slice.slice(0, breakIndex) : slice.slice(0, maxChars)
  return `${bounded.trimEnd()}...`
}

export function StoryBriefingHeader({detail}: StoryBriefingHeaderProps) {
  const dek = compactText(detail.dek, 220)
  const shouldShowWhyItMatters = detail.whyItMatters.trim() && detail.whyItMatters.trim() !== detail.dek.trim()
  const whyItMatters = shouldShowWhyItMatters ? compactText(detail.whyItMatters, 170) : null

  return (
    <header className="space-y-4 pb-4">
      <p className="text-muted-foreground text-xs tracking-[0.08em] uppercase">
        {new Date(detail.publishedAt).toLocaleString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })}
      </p>
      <h1 className="font-display text-[2.65rem] leading-tight text-foreground md:text-[3.2rem]">
        {detail.headline}
      </h1>
      {dek ? (
        <p className="text-muted-foreground text-[1.08rem] leading-relaxed">
          {dek}
        </p>
      ) : null}
    </header>
  );
}
