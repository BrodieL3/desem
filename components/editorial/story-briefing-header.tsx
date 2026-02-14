import {Badge} from '@/components/ui/badge'
import type {CuratedStoryDetail} from '@/lib/editorial/ui-types'

type StoryBriefingHeaderProps = {
  detail: CuratedStoryDetail
}

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatTimestamp(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return timestampFormatter.format(parsed)
}

function riskBadgeClass(level: CuratedStoryDetail['riskLevel']) {
  if (level === 'high') {
    return 'bg-destructive/15 text-destructive'
  }

  if (level === 'medium') {
    return 'bg-warning/20 text-warning-foreground'
  }

  return 'bg-success/20 text-success-foreground'
}

export function StoryBriefingHeader({detail}: StoryBriefingHeaderProps) {
  const shouldShowWhyItMatters = detail.whyItMatters.trim() && detail.whyItMatters.trim() !== detail.dek.trim()

  return (
    <header className="space-y-4 border-b border-border pb-8">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {detail.topicLabel ? (
          <Badge variant="secondary" className="uppercase tracking-wide">
            {detail.topicLabel}
          </Badge>
        ) : null}
        <Badge variant="secondary" className={`uppercase tracking-wide ${riskBadgeClass(detail.riskLevel)}`}>
          {detail.riskLevel} risk
        </Badge>
        <span className="text-muted-foreground">{detail.citationCount} sources</span>
        <span className="text-muted-foreground">Updated {formatTimestamp(detail.publishedAt)}</span>
      </div>
      <h1 className="font-display text-[2.65rem] leading-tight text-foreground md:text-[3.2rem]">{detail.headline}</h1>
      <p className="text-muted-foreground text-base leading-relaxed">{detail.dek}</p>
      {shouldShowWhyItMatters ? (
        <p className="text-muted-foreground text-base leading-relaxed">
          <span className="text-foreground font-semibold">Why it matters:</span> {detail.whyItMatters}
        </p>
      ) : null}
    </header>
  )
}
