import {SignalPill} from '@/components/newsfeed/atoms/signal-pill'
import {briefingTrackLabels, type BriefingTrack} from '@/lib/defense/constants'
import {getTrackPillClass} from '@/lib/defense/story-theme'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

type StoryMetaRowProps = {
  publishedAt: string
  domain: string
  sourceBadge: string
  track: Exclude<BriefingTrack, 'all'>
  highImpact: boolean
}

export function StoryMetaRow({publishedAt, domain, sourceBadge, track, highImpact}: StoryMetaRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SignalPill label={briefingTrackLabels[track]} className={getTrackPillClass(track)} />
      <SignalPill label={domain} tone="muted" />
      <SignalPill label={sourceBadge} />
      {highImpact ? <SignalPill label="High impact" tone="critical" className="border-rose-200 bg-rose-100 text-rose-700" /> : null}
      <span className="text-muted-foreground ml-auto text-[11px] tracking-[0.06em] uppercase">
        {dateFormatter.format(new Date(publishedAt))}
      </span>
    </div>
  )
}
