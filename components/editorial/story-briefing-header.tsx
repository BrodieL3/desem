import type {CuratedStoryDetail} from '@/lib/editorial/ui-types'

type StoryBriefingHeaderProps = {
  detail: CuratedStoryDetail
}

export function StoryBriefingHeader({detail}: StoryBriefingHeaderProps) {
  const shouldShowWhyItMatters = detail.whyItMatters.trim() && detail.whyItMatters.trim() !== detail.dek.trim()

  return (
    <header className="space-y-4 border-b border-border pb-8 text-center">
      {detail.topicLabel ? <p className="text-muted-foreground text-xs tracking-[0.12em] uppercase">{detail.topicLabel}</p> : null}
      <p className="text-muted-foreground text-xs tracking-[0.08em] uppercase">{detail.attributionLine}</p>
      <h1 className="font-display text-[2.65rem] leading-tight text-foreground md:text-[3.2rem]">{detail.headline}</h1>
      <p className="text-muted-foreground text-[1.08rem] leading-relaxed">{detail.dek}</p>
      {shouldShowWhyItMatters ? (
        <p className="text-muted-foreground text-[1.05rem] leading-relaxed">
          <span className="text-foreground font-semibold">Why it matters:</span> {detail.whyItMatters}
        </p>
      ) : null}
    </header>
  )
}
