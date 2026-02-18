export type CuratedRiskLevel = 'low' | 'medium' | 'high'

export type CuratedGenerationMode = 'deterministic' | 'transform'

export type CuratedReviewStatus = 'needs_review' | 'approved' | 'published'

export type EditorialSource = 'sanity' | 'raw-fallback'
export type CuratedSourceRole = 'reporting' | 'analysis' | 'official' | 'opinion'

export type CuratedSourceLink = {
  articleId: string
  sourceName: string
  url: string
  headline: string
  sourceRole: CuratedSourceRole
}

type CuratedCurationSummary = {
  hasOfficialSource: boolean
  reportingCount: number
  analysisCount: number
  officialCount: number
  opinionCount: number
  pressReleaseDriven: boolean
  opinionLimited: boolean
  sourceDiversity: number
}

export type CuratedStoryCardTopic = {
  slug: string
  label: string
}

export type CuratedStoryCard = {
  clusterKey: string
  headline: string
  dek: string
  expandedDek?: string | null
  whyItMatters: string
  riskLevel: CuratedRiskLevel
  citationCount: number
  generationMode: CuratedGenerationMode
  reviewStatus: CuratedReviewStatus
  isCongestedCluster: boolean
  publishedAt: string
  sourceName: string
  imageUrl?: string | null
  sourceLinks: CuratedSourceLink[]
  topics?: CuratedStoryCardTopic[]
  score: number
} & CuratedCurationSummary

export type CuratedRail = {
  topicLabel: string
  stories: CuratedStoryCard[]
  source: EditorialSource
  generatedAt: string
}

export type CuratedHomePayload = {
  stories: CuratedStoryCard[]
  semaforRail: CuratedStoryCard[]
  source: EditorialSource
  generatedAt: string
  notice: string | null
}

export type CuratedHomeForYouTopic = {
  id: string
  slug: string
  label: string
  articleCount: number
  followed: boolean
}

export type CuratedStoryTopic = CuratedHomeForYouTopic

export type CuratedHomeForYouRail = {
  title: string
  stories: CuratedStoryCard[]
  topics: CuratedHomeForYouTopic[]
  isPersonalized: boolean
  notice: string | null
}

export type EvidenceBlock = {
  id: string
  articleId: string
  sourceName: string
  headline: string
  excerpt: string
  publishedAt: string | null
  articleUrl: string
  sourceBadge: string | null
}

export type StoryFeedBlock = {
  id: string
  body: string
  wordCount: number
  imageUrl?: string | null
  imageAlt?: string | null
}

export type CuratedStoryDetail = {
  clusterKey: string
  topicLabel: string | null
  attributionLine: string
  headline: string
  dek: string
  whyItMatters: string
  riskLevel: CuratedRiskLevel
  citationCount: number
  generationMode: CuratedGenerationMode
  reviewStatus: CuratedReviewStatus
  isCongestedCluster: boolean
  publishedAt: string
  heroImageUrl?: string | null
  sourceLinks: CuratedSourceLink[]
  topics: CuratedStoryTopic[]
  feedBlocks: StoryFeedBlock[]
  totalFeedBlocks: number
  evidence: EvidenceBlock[]
  totalEvidence: number
  offset: number
  limit: number
  hasMore: boolean
  source: EditorialSource
} & CuratedCurationSummary
