export type EditorialTopic = {
  id: string
  slug: string
  label: string
  isPrimary: boolean
}

export type EditorialArticle = {
  id: string
  title: string
  summary: string | null
  fullTextExcerpt: string | null
  articleUrl: string
  sourceId: string
  sourceName: string
  sourceBadge: string
  publishedAt: string | null
  fetchedAt: string
  wordCount: number
  readingMinutes: number
  contentFetchStatus: string | null
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
  generationMode: 'deterministic' | 'transform'
  reviewStatus: 'needs_review' | 'approved' | 'published'
  isCongestedCluster: boolean
  articleCount24h: number
  uniqueSources24h: number
  congestionScore: number
  representativeArticleId: string
}
