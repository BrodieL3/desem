import type {TopicType} from '@/lib/topics/taxonomy'

export type ArticleTopic = {
  id: string
  slug: string
  label: string
  topicType: TopicType
  confidence: number
  occurrences: number
  isPrimary: boolean
}

export type ArticleCard = {
  id: string
  title: string
  summary: string | null
  fullTextExcerpt: string | null
  articleUrl: string
  sourceId: string
  sourceName: string
  sourceBadge: string
  sourceWeight: number
  publishedAt: string | null
  fetchedAt: string
  leadImageUrl: string | null
  canonicalImageUrl: string | null
  wordCount: number
  readingMinutes: number
  contentFetchStatus: string | null
  commentCount: number
  topics: ArticleTopic[]
  personalizationScore: number
}

export type TopicSummary = {
  id: string
  slug: string
  label: string
  topicType: TopicType
  articleCount: number
  followed: boolean
}

export type ArticleComment = {
  id: string
  storyKey: string
  userId: string
  body: string | null
  status: 'active' | 'hidden'
  createdAt: string
  updatedAt: string
  isOwn: boolean
  reportedByViewer: boolean
}
