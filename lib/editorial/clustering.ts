import {sanitizeHeadlineText, sanitizePlainText} from '@/lib/utils'

import {editorialSourceRolePriority, resolveEditorialSourceRole} from './curation'
import type {EditorialArticle, StoryCluster} from './types'

type BuildStoryClustersOptions = {
  threshold?: number
  windowHours?: number
  openAIApiKey?: string
  embeddingModel?: string
  maxEmbeddingArticles?: number
}

type ScoringContext = {
  embeddingsByArticleId: Map<string, number[]>
}

class UnionFind {
  private readonly parent: number[]
  private readonly rank: number[]

  constructor(size: number) {
    this.parent = Array.from({length: size}, (_, index) => index)
    this.rank = Array.from({length: size}, () => 0)
  }

  find(value: number): number {
    if (this.parent[value] !== value) {
      this.parent[value] = this.find(this.parent[value])
    }

    return this.parent[value]
  }

  union(left: number, right: number) {
    const leftRoot = this.find(left)
    const rightRoot = this.find(right)

    if (leftRoot === rightRoot) {
      return
    }

    if (this.rank[leftRoot] < this.rank[rightRoot]) {
      this.parent[leftRoot] = rightRoot
      return
    }

    if (this.rank[leftRoot] > this.rank[rightRoot]) {
      this.parent[rightRoot] = leftRoot
      return
    }

    this.parent[rightRoot] = leftRoot
    this.rank[leftRoot] += 1
  }
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function normalizeTitle(value: string) {
  return sanitizeHeadlineText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeTitle(value: string) {
  const normalized = normalizeTitle(value)
  if (!normalized) {
    return new Set<string>()
  }

  return new Set(
    normalized
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
  )
}

function jaccardSimilarity(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) {
    return 0
  }

  let intersection = 0

  for (const token of left) {
    if (right.has(token)) {
      intersection += 1
    }
  }

  const union = left.size + right.size - intersection

  if (union <= 0) {
    return 0
  }

  return intersection / union
}

function topicSimilarity(left: EditorialArticle, right: EditorialArticle) {
  const leftTopics = new Set(left.topics.map((topic) => topic.slug))
  const rightTopics = new Set(right.topics.map((topic) => topic.slug))
  return jaccardSimilarity(leftTopics, rightTopics)
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0
  }

  let dot = 0
  let leftNorm = 0
  let rightNorm = 0

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftNorm += left[index] * left[index]
    rightNorm += right[index] * right[index]
  }

  if (leftNorm <= 0 || rightNorm <= 0) {
    return 0
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

function clusterKeyForArticle(article: EditorialArticle) {
  const normalized = normalizeTitle(article.title)
  const slug = normalized
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 68)
  const referenceTs = parseTimestamp(article.publishedAt ?? article.fetchedAt)
  const dateSuffix = referenceTs ? new Date(referenceTs).toISOString().slice(0, 10).replace(/-/g, '') : 'undated'

  return `${slug || 'story'}-${dateSuffix}`
}

function pickRepresentative(members: EditorialArticle[]) {
  return [...members].sort((left, right) => {
    const rightRole = resolveEditorialSourceRole({
      sourceId: right.sourceId,
      sourceName: right.sourceName,
      sourceBadge: right.sourceBadge,
      sourceCategory: right.sourceCategory,
      title: right.title,
    })
    const leftRole = resolveEditorialSourceRole({
      sourceId: left.sourceId,
      sourceName: left.sourceName,
      sourceBadge: left.sourceBadge,
      sourceCategory: left.sourceCategory,
      title: left.title,
    })

    const roleDiff = editorialSourceRolePriority(rightRole) - editorialSourceRolePriority(leftRole)

    if (roleDiff !== 0) {
      return roleDiff
    }

    const rightPrimaryTopics = right.topics.filter((topic) => topic.isPrimary).length
    const leftPrimaryTopics = left.topics.filter((topic) => topic.isPrimary).length

    if (rightPrimaryTopics !== leftPrimaryTopics) {
      return rightPrimaryTopics - leftPrimaryTopics
    }

    return parseTimestamp(right.publishedAt ?? right.fetchedAt) - parseTimestamp(left.publishedAt ?? left.fetchedAt)
  })[0]
}

function dominantTopicLabel(members: EditorialArticle[]) {
  const counts = new Map<string, number>()

  for (const member of members) {
    for (const topic of member.topics) {
      counts.set(topic.label, (counts.get(topic.label) ?? 0) + (topic.isPrimary ? 2 : 1))
    }
  }

  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  return ranked[0]?.[0] ?? null
}

async function fetchEmbeddings(articles: EditorialArticle[], options: BuildStoryClustersOptions) {
  const apiKey = options.openAIApiKey

  if (!apiKey) {
    return new Map<string, number[]>()
  }

  const maxEmbeddingArticles = Math.max(1, options.maxEmbeddingArticles ?? 120)
  const selected = [...articles]
    .sort((left, right) => parseTimestamp(right.publishedAt ?? right.fetchedAt) - parseTimestamp(left.publishedAt ?? left.fetchedAt))
    .slice(0, maxEmbeddingArticles)

  const embeddingsByArticleId = new Map<string, number[]>()

  for (const article of selected) {
    const input = sanitizePlainText(`${article.title}. ${article.summary ?? article.fullTextExcerpt ?? ''}`)

    if (!input) {
      continue
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.embeddingModel ?? 'text-embedding-3-small',
        input: input.slice(0, 3500),
      }),
    })

    if (!response.ok) {
      continue
    }

    const payload = (await response.json().catch(() => null)) as
      | {
          data?: Array<{embedding?: number[]}>
        }
      | null

    const vector = payload?.data?.[0]?.embedding

    if (!vector || vector.length === 0) {
      continue
    }

    embeddingsByArticleId.set(article.id, vector)
  }

  return embeddingsByArticleId
}

function scorePair(left: EditorialArticle, right: EditorialArticle, context: ScoringContext) {
  const lexicalScore = jaccardSimilarity(tokenizeTitle(left.title), tokenizeTitle(right.title))
  const topicScore = topicSimilarity(left, right)

  const leftEmbedding = context.embeddingsByArticleId.get(left.id)
  const rightEmbedding = context.embeddingsByArticleId.get(right.id)
  const embeddingScore = leftEmbedding && rightEmbedding ? cosineSimilarity(leftEmbedding, rightEmbedding) : null

  if (embeddingScore === null) {
    return 0.7 * lexicalScore + 0.3 * topicScore
  }

  return 0.45 * embeddingScore + 0.35 * lexicalScore + 0.2 * topicScore
}

export async function buildStoryClusters(
  articles: EditorialArticle[],
  options: BuildStoryClustersOptions = {}
): Promise<StoryCluster[]> {
  if (articles.length === 0) {
    return []
  }

  const sorted = [...articles].sort(
    (left, right) => parseTimestamp(right.publishedAt ?? right.fetchedAt) - parseTimestamp(left.publishedAt ?? left.fetchedAt)
  )

  const threshold = options.threshold ?? 0.72
  const windowMs = (options.windowHours ?? 48) * 60 * 60 * 1000
  const embeddingsByArticleId = await fetchEmbeddings(sorted, options)

  const unionFind = new UnionFind(sorted.length)
  const pairScoreByKey = new Map<string, number>()

  for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
    const left = sorted[leftIndex]
    const leftTimestamp = parseTimestamp(left.publishedAt ?? left.fetchedAt)

    for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
      const right = sorted[rightIndex]
      const rightTimestamp = parseTimestamp(right.publishedAt ?? right.fetchedAt)

      if (Math.abs(leftTimestamp - rightTimestamp) > windowMs) {
        continue
      }

      const score = scorePair(left, right, {embeddingsByArticleId})
      pairScoreByKey.set(`${left.id}:${right.id}`, score)
      pairScoreByKey.set(`${right.id}:${left.id}`, score)

      if (score >= threshold) {
        unionFind.union(leftIndex, rightIndex)
      }
    }
  }

  const byRoot = new Map<number, EditorialArticle[]>()

  for (let index = 0; index < sorted.length; index += 1) {
    const root = unionFind.find(index)
    const members = byRoot.get(root) ?? []
    members.push(sorted[index])
    byRoot.set(root, members)
  }

  const clusters: StoryCluster[] = []

  for (const members of byRoot.values()) {
    const representative = pickRepresentative(members)

    if (!representative) {
      continue
    }

    const clusterKey = clusterKeyForArticle(representative)

    clusters.push({
      clusterKey,
      representativeArticle: representative,
      topicLabel: dominantTopicLabel(members),
      members: members.map((member) => {
        if (member.id === representative.id) {
          return {
            article: member,
            isRepresentative: true,
            similarity: 1,
          }
        }

        const score =
          pairScoreByKey.get(`${representative.id}:${member.id}`) ??
          scorePair(representative, member, {
            embeddingsByArticleId,
          })

        return {
          article: member,
          isRepresentative: false,
          similarity: Number(score.toFixed(3)),
        }
      }),
    })
  }

  return clusters.sort((left, right) => {
    const rightSize = right.members.length
    const leftSize = left.members.length

    if (rightSize !== leftSize) {
      return rightSize - leftSize
    }

    return (
      parseTimestamp(right.representativeArticle.publishedAt ?? right.representativeArticle.fetchedAt) -
      parseTimestamp(left.representativeArticle.publishedAt ?? left.representativeArticle.fetchedAt)
    )
  })
}
