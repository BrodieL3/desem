import Link from 'next/link'

import {Badge} from '@/components/ui/badge'
import type {CuratedStoryCard} from '@/lib/editorial/ui-types'

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatTimestamp(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return timeFormatter.format(parsed)
}

type StoryCardProps = {
  card: CuratedStoryCard
  showImage?: boolean
  featured?: boolean
}

function sourceMixLabel(card: CuratedStoryCard) {
  const totalRoleCount = card.reportingCount + card.officialCount + card.analysisCount + card.opinionCount

  if (totalRoleCount <= 1 && card.citationCount <= 1) {
    return null
  }

  const parts: string[] = []

  if (card.reportingCount > 0) {
    parts.push(`${card.reportingCount} reporting`)
  }

  if (card.officialCount > 0) {
    parts.push(`${card.officialCount} official`)
  }

  if (card.analysisCount > 0) {
    parts.push(`${card.analysisCount} analysis`)
  }

  if (card.opinionCount > 0) {
    parts.push(`${card.opinionCount} opinion`)
  }

  if (parts.length > 0) {
    return parts.join(' • ')
  }

  if (card.citationCount <= 1) {
    return null
  }

  return `${card.citationCount} sources`
}

function sourceDiversityLabel(card: CuratedStoryCard) {
  if (card.sourceDiversity <= 1) {
    return null
  }

  return `${card.sourceDiversity} unique sources`
}

function riskBadgeClass(level: CuratedStoryCard['riskLevel']) {
  if (level === 'high') {
    return 'bg-destructive/15 text-destructive'
  }

  if (level === 'medium') {
    return 'bg-warning/20 text-warning-foreground'
  }

  return 'bg-success/20 text-success-foreground'
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

export function StoryCard({card, showImage = false, featured = false}: StoryCardProps) {
  const displayImage = showImage && Boolean(card.imageUrl)
  const mixLabel = sourceMixLabel(card)
  const diversityLabel = sourceDiversityLabel(card)
  const leadDek = compactText(card.dek.trim() || card.whyItMatters.trim(), featured ? 220 : 170)

  return (
    <article className="news-divider-item relative flex flex-col overflow-hidden px-1 transition-colors duration-200">
      <Link
        href={`/stories/${encodeURIComponent(card.clusterKey)}`}
        className="group block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <header className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-sm font-semibold">{card.sourceName}</span>
          <span className="text-muted-foreground">{formatTimestamp(card.publishedAt)}</span>
          <Badge variant="secondary" className={`text-[10px] uppercase tracking-[0.08em] ${riskBadgeClass(card.riskLevel)}`}>
            {card.riskLevel} risk
          </Badge>
          {diversityLabel ? <span className="text-muted-foreground">{diversityLabel}</span> : null}
        </header>

        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageUrl ?? undefined}
            alt={card.headline}
            className={`mb-4 w-full object-cover ${featured ? 'h-52' : 'h-40'}`}
            loading="lazy"
          />
        ) : null}

        <h3 className={`font-display leading-tight transition-colors group-hover:text-primary ${featured ? 'text-[2.1rem]' : 'text-[1.85rem]'}`}>
          {card.headline}
        </h3>

        {leadDek ? <p className="text-muted-foreground mt-3 text-base leading-relaxed">{leadDek}</p> : null}
        {mixLabel ? <p className="text-muted-foreground mt-4 text-[11px] tracking-[0.08em] uppercase">{mixLabel}</p> : null}
      </Link>
    </article>
  )
}
