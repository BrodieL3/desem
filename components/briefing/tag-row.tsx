import {Badge} from '@/components/ui/badge'

import type {DefenseSemaformStory} from '@/lib/defense/types'

const domainLabels: Record<string, string> = {
  land: 'Land',
  air: 'Air',
  maritime: 'Maritime',
  space: 'Space',
  cyber: 'Cyber',
  'multi-domain': 'Multi-domain',
}

const statusLabels: Record<string, string> = {
  'pre-rfi': 'Pre-RFI',
  rfi: 'RFI',
  rfp: 'RFP',
  'source-selection': 'Source selection',
  awarded: 'Awarded',
  prototyping: 'Prototyping',
  lrip: 'LRIP',
  frp: 'FRP',
}

const horizonLabels: Record<string, string> = {
  near: 'Near term',
  medium: 'Medium term',
  long: 'Long term',
}

type TagRowProps = {
  story: DefenseSemaformStory
}

export function TagRow({story}: TagRowProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary">Domain: {domainLabels[story.domain] ?? story.domain}</Badge>
      {story.missionTags.map((tag) => (
        <Badge key={tag} variant="outline">
          Mission: {tag}
        </Badge>
      ))}
      {story.acquisitionStatus ? (
        <Badge variant="outline">Stage: {statusLabels[story.acquisitionStatus] ?? story.acquisitionStatus}</Badge>
      ) : null}
      {story.horizon ? <Badge variant="outline">Horizon: {horizonLabels[story.horizon] ?? story.horizon}</Badge> : null}
    </div>
  )
}
