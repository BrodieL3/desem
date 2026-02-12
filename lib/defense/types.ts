import type {BriefingTrack, QuickFilter, Station} from './constants'

export type Horizon = 'near' | 'medium' | 'long'
export type Domain = 'land' | 'air' | 'maritime' | 'space' | 'cyber' | 'multi-domain'

export type SourceBadge =
  | 'DoD release'
  | 'SAM.gov'
  | 'Program office'
  | 'Funding'
  | 'Policy doc'
  | 'Analysis'

export type ContentType = 'conflict' | 'program' | 'budget' | 'policy' | 'funding' | 'tech'

export interface AnalystViewItem {
  station: Station
  bullets: string[]
}

export interface ViewFromItem {
  perspective: string
  note: string
}

export interface NotableLink {
  label: string
  url: string
  source?: 'primary' | 'secondary' | 'deep_dive' | 'critique'
}

export interface DefenseSemaformStory {
  id: string
  title: string
  slug: string
  publishedAt: string
  deck?: string
  domain: Domain | string
  missionTags: string[]
  technologyTags: string[]
  acquisitionStatus?: string
  horizon?: Horizon
  sourceBadge: SourceBadge | string
  sourceUrl?: string
  track: Exclude<BriefingTrack, 'all'>
  contentType: ContentType
  highImpact: boolean
  theNews: string[]
  analystView: AnalystViewItem[]
  roomForDisagreement: string[]
  viewFrom: ViewFromItem[]
  notableLinks: NotableLink[]
  featured: boolean
}

export type DefenseStory = DefenseSemaformStory

export interface FeedContext {
  track: BriefingTrack
  quickFilter: QuickFilter
  myMissions: string[]
}
