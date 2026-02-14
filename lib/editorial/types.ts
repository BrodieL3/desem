import type {TopicType} from '@/lib/topics/taxonomy'
import type {DefenseSourceStoryRole} from '@/lib/ingest/sources'

export type EditorialTopic = {
  id: string
  slug: string
  label: string
  topicType: TopicType
  isPrimary: boolean
}

export type EditorialArticle = {
  id: string
  title: string
  summary: string | null
  fullText?: string | null
  fullTextExcerpt: string | null
  articleUrl: string
  sourceId: string
  sourceName: string
  sourceCategory: string
  sourceBadge: string
  publishedAt: string | null
  fetchedAt: string
  wordCount: number
  readingMinutes: number
  contentFetchStatus: string | null
  leadImageUrl?: string | null
  canonicalImageUrl?: string | null
  topics: EditorialTopic[]
}

export type ClusterMember = {
  article: EditorialArticle
  similarity: number
  isRepresentative: boolean
}

export type StoryCluster = {
  clusterKey: string
  representativeArticle: EditorialArticle
  members: ClusterMember[]
  topicLabel: string | null
}

export type CongestionEvaluation = {
  articleCount24h: number
  uniqueSources24h: number
  congestionScore: number
  isCongested: boolean
}

export type StoryDigestCitation = {
  articleId: string
  headline: string
  sourceName: string
  url: string
  sourceRole: DefenseSourceStoryRole
}

export type StoryDigestRecord = {
  clusterKey: string
  headline: string
  dek: string
  keyPoints: string[]
  whyItMatters: string
  riskLevel: 'low' | 'medium' | 'high'
  citations: StoryDigestCitation[]
  citationCount: number
  hasOfficialSource: boolean
  reportingCount: number
  analysisCount: number
  officialCount: number
  opinionCount: number
  pressReleaseDriven: boolean
  opinionLimited: boolean
  sourceDiversity: number
  generationMode: 'deterministic' | 'transform'
  reviewStatus: 'needs_review' | 'approved' | 'published'
  isCongestedCluster: boolean
  articleCount24h: number
  uniqueSources24h: number
  congestionScore: number
  representativeArticleId: string
}
