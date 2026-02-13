import {sanitizeHeadlineText, sanitizePlainText} from '@/lib/utils'

import type {CongestionEvaluation, StoryCluster, StoryDigestRecord} from './types'

function compact(value: string) {
  return sanitizePlainText(value).replace(/\s+/g, ' ').trim()
}

function splitSentences(input: string) {
  return compact(input)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 30)
}

function collectKeyPoints(cluster: StoryCluster, maxPoints = 5) {
  const sentences: string[] = []

  for (const member of cluster.members.slice(0, 12)) {
    const sourceText = member.article.summary ?? member.article.fullTextExcerpt ?? ''

    if (!sourceText) {
      continue
    }

    for (const sentence of splitSentences(sourceText)) {
      sentences.push(sentence)

      if (sentences.length >= maxPoints * 4) {
        break
      }
    }

    if (sentences.length >= maxPoints * 4) {
      break
    }
  }

  const deduped = new Set<string>()
  const points: string[] = []

  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()

    if (deduped.has(normalized)) {
      continue
    }

    deduped.add(normalized)
    points.push(sentence)

    if (points.length >= maxPoints) {
      break
    }
  }

  if (points.length > 0) {
    return points
  }

  return ['Coverage is still developing. Review cited reporting for the latest details.']
}

function determineRiskLevel(cluster: StoryCluster, congestion: CongestionEvaluation): StoryDigestRecord['riskLevel'] {
  const text = `${cluster.representativeArticle.title} ${cluster.representativeArticle.summary ?? ''}`.toLowerCase()

  if (
    congestion.articleCount24h >= 14 ||
    /(strike|missile|nuclear|conflict|deterrence|airspace|incursion|sanction|mobilization)/.test(text)
  ) {
    return 'high'
  }

  if (congestion.articleCount24h >= 8 || /(exercise|deployment|procurement|counter|security)/.test(text)) {
    return 'medium'
  }

  return 'low'
}

function buildDek(cluster: StoryCluster) {
  const summary = cluster.representativeArticle.summary ?? cluster.representativeArticle.fullTextExcerpt ?? ''

  if (!summary) {
    return `Multi-source defense coverage from ${new Set(cluster.members.map((member) => member.article.sourceName)).size} outlets.`
  }

  const normalized = compact(summary)
  return normalized.length <= 220 ? normalized : `${normalized.slice(0, 217).trimEnd()}...`
}

export function buildDeterministicStoryDigest(
  cluster: StoryCluster,
  congestion: CongestionEvaluation
): StoryDigestRecord {
  const uniqueSources = new Set(cluster.members.map((member) => member.article.sourceName))

  return {
    clusterKey: cluster.clusterKey,
    headline: sanitizeHeadlineText(cluster.representativeArticle.title),
    dek: buildDek(cluster),
    keyPoints: collectKeyPoints(cluster),
    whyItMatters: cluster.topicLabel
      ? `${uniqueSources.size} sources are converging on ${cluster.topicLabel}. This digest highlights operational and policy implications without collapsing distinct reporting lines.`
      : `${uniqueSources.size} sources are covering this developing defense story. The digest summarizes overlapping facts and preserves source-attributed context.`,
    riskLevel: determineRiskLevel(cluster, congestion),
    citations: cluster.members.slice(0, 10).map((member) => ({
      articleId: member.article.id,
      headline: sanitizeHeadlineText(member.article.title),
      sourceName: member.article.sourceName,
      url: member.article.articleUrl,
    })),
    citationCount: Math.min(cluster.members.length, 10),
    generationMode: 'deterministic',
    reviewStatus: 'needs_review',
    isCongestedCluster: congestion.isCongested,
    articleCount24h: congestion.articleCount24h,
    uniqueSources24h: congestion.uniqueSources24h,
    congestionScore: congestion.congestionScore,
    representativeArticleId: cluster.representativeArticle.id,
  }
}
