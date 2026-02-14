import type {SanityClient} from '@sanity/client'

import {defaultCongestionRules, evaluateClusterCongestion, type CongestionRules} from '@/lib/editorial/congestion'
import {buildDeterministicStoryDigest} from '@/lib/editorial/deterministic-digest'
import type {EditorialArticle, StoryCluster} from '@/lib/editorial/types'
import {transformStoryDigestInPlace} from '@/lib/sanity/transform'

type SyncOptions = {
  client: SanityClient
  schemaId?: string | null
  clusters: StoryCluster[]
  transformEnabled?: boolean
  now?: Date
  congestionRules?: CongestionRules
}

export type SyncedClusterRecord = {
  clusterKey: string
  representativeArticleId: string
  headline: string
  topicLabel: string | null
  articleCount24h: number
  uniqueSources24h: number
  congestionScore: number
  isCongested: boolean
  transformAttempted: boolean
  transformStatus: 'skipped' | 'succeeded' | 'failed'
  generationMode: 'deterministic' | 'transform'
  reviewStatus: 'needs_review' | 'approved' | 'published'
}

export type SyncEditorialResult = {
  newsItemCount: number
  digestCount: number
  transformAttemptedCount: number
  transformSucceededCount: number
  transformFailedCount: number
  clusters: SyncedClusterRecord[]
}

function sanitizeSanityId(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 110)
}

function newsItemDraftId(articleId: string) {
  return `drafts.newsItem-${sanitizeSanityId(articleId)}`
}

function storyDigestDraftId(clusterKey: string) {
  return `drafts.storyDigest-${sanitizeSanityId(clusterKey)}`
}

function toNowIso(now: Date) {
  return now.toISOString()
}

function mapNewsItemDraft(input: {
  article: EditorialArticle
  clusterKey: string | null
  isCongestedCluster: boolean
  generatedAt: Date
}) {
  const article = input.article

  return {
    _id: newsItemDraftId(article.id),
    _type: 'newsItem',
    articleId: article.id,
    clusterKey: input.clusterKey,
    title: article.title,
    summary: article.summary,
    fullText: article.fullText ?? null,
    fullTextExcerpt: article.fullTextExcerpt,
    articleUrl: article.articleUrl,
    sourceId: article.sourceId,
    sourceName: article.sourceName,
    sourceCategory: article.sourceCategory,
    sourceBadge: article.sourceBadge,
    publishedAt: article.publishedAt,
    fetchedAt: article.fetchedAt,
    wordCount: article.wordCount,
    readingMinutes: article.readingMinutes,
    contentFetchStatus: article.contentFetchStatus,
    isCongestedCluster: input.isCongestedCluster,
    leadImageUrl: article.leadImageUrl ?? null,
    canonicalImageUrl: article.canonicalImageUrl ?? null,
    topics: article.topics.map((topic, index) => ({
      _key: `${topic.slug}-${index}`,
      topicId: topic.id,
      slug: topic.slug,
      label: topic.label,
      topicType: topic.topicType,
      isPrimary: topic.isPrimary,
    })),
    syncedAt: toNowIso(input.generatedAt),
  }
}

function mapStoryDigestDraft(input: {
  digest: ReturnType<typeof buildDeterministicStoryDigest>
  topicLabel: string | null
  transformStatus: 'skipped' | 'succeeded' | 'failed'
  generatedAt: Date
}) {
  const digest = input.digest

  return {
    _id: storyDigestDraftId(digest.clusterKey),
    _type: 'storyDigest',
    clusterKey: digest.clusterKey,
    representativeArticleId: digest.representativeArticleId,
    topicLabel: input.topicLabel,
    headline: digest.headline,
    dek: digest.dek,
    keyPoints: digest.keyPoints,
    whyItMatters: digest.whyItMatters,
    riskLevel: digest.riskLevel,
    citations: digest.citations.map((citation) => ({
      _key: citation.articleId,
      articleId: citation.articleId,
      headline: citation.headline,
      sourceName: citation.sourceName,
      url: citation.url,
      sourceRole: citation.sourceRole,
    })),
    citationCount: digest.citationCount,
    hasOfficialSource: digest.hasOfficialSource,
    reportingCount: digest.reportingCount,
    analysisCount: digest.analysisCount,
    officialCount: digest.officialCount,
    opinionCount: digest.opinionCount,
    pressReleaseDriven: digest.pressReleaseDriven,
    opinionLimited: digest.opinionLimited,
    sourceDiversity: digest.sourceDiversity,
    generationMode: digest.generationMode,
    transformStatus: input.transformStatus,
    reviewStatus: digest.reviewStatus,
    isCongestedCluster: digest.isCongestedCluster,
    articleCount24h: digest.articleCount24h,
    uniqueSources24h: digest.uniqueSources24h,
    congestionScore: digest.congestionScore,
    generatedAt: toNowIso(input.generatedAt),
  }
}

async function upsertNewsItems(input: {
  client: SanityClient
  articles: EditorialArticle[]
  clusterByArticleId: Map<string, {clusterKey: string; isCongested: boolean}>
  now: Date
}) {
  let count = 0

  for (const article of input.articles) {
    const cluster = input.clusterByArticleId.get(article.id)

    await input.client.createOrReplace(
      mapNewsItemDraft({
        article,
        clusterKey: cluster?.clusterKey ?? null,
        isCongestedCluster: cluster?.isCongested ?? false,
        generatedAt: input.now,
      })
    )

    count += 1
  }

  return count
}

export async function syncEditorialDrafts(input: SyncOptions): Promise<SyncEditorialResult> {
  const now = input.now ?? new Date()
  const rules = input.congestionRules ?? defaultCongestionRules
  const transformEnabled = Boolean(input.transformEnabled)
  const schemaId = input.schemaId ?? null

  const clusterByArticleId = new Map<string, {clusterKey: string; isCongested: boolean}>()
  for (const cluster of input.clusters) {
    const congestion = evaluateClusterCongestion(cluster, {now, rules})

    for (const member of cluster.members) {
      clusterByArticleId.set(member.article.id, {
        clusterKey: cluster.clusterKey,
        isCongested: congestion.isCongested,
      })
    }
  }

  const uniqueArticles = new Map<string, EditorialArticle>()

  for (const cluster of input.clusters) {
    for (const member of cluster.members) {
      uniqueArticles.set(member.article.id, member.article)
    }
  }

  const newsItemCount = await upsertNewsItems({
    client: input.client,
    articles: [...uniqueArticles.values()],
    clusterByArticleId,
    now,
  })

  const clusterResults: SyncedClusterRecord[] = []
  let transformAttemptedCount = 0
  let transformSucceededCount = 0
  let transformFailedCount = 0

  for (const cluster of input.clusters) {
    const congestion = evaluateClusterCongestion(cluster, {now, rules})
    const digest = buildDeterministicStoryDigest(cluster, congestion)
    const digestDocumentId = storyDigestDraftId(cluster.clusterKey)

    let transformStatus: SyncedClusterRecord['transformStatus'] = 'skipped'
    let generationMode: SyncedClusterRecord['generationMode'] = 'deterministic'

    await input.client.createOrReplace(
      mapStoryDigestDraft({
        digest,
        topicLabel: cluster.topicLabel,
        transformStatus,
        generatedAt: now,
      })
    )

    if (congestion.isCongested && transformEnabled && schemaId) {
      transformAttemptedCount += 1

      try {
        await transformStoryDigestInPlace({
          client: input.client,
          schemaId,
          documentId: digestDocumentId,
          digest,
          cluster,
        })

        transformStatus = 'succeeded'
        generationMode = 'transform'
        transformSucceededCount += 1
      } catch {
        transformStatus = 'failed'
        generationMode = 'deterministic'
        transformFailedCount += 1
      }

      await input.client
        .patch(digestDocumentId)
        .set({
          transformStatus,
          generationMode,
          reviewStatus: 'needs_review',
          generatedAt: toNowIso(now),
        })
        .commit()
    }

    clusterResults.push({
      clusterKey: cluster.clusterKey,
      representativeArticleId: cluster.representativeArticle.id,
      headline: digest.headline,
      topicLabel: cluster.topicLabel,
      articleCount24h: congestion.articleCount24h,
      uniqueSources24h: congestion.uniqueSources24h,
      congestionScore: congestion.congestionScore,
      isCongested: congestion.isCongested,
      transformAttempted: transformStatus !== 'skipped',
      transformStatus,
      generationMode,
      reviewStatus: 'needs_review',
    })
  }

  return {
    newsItemCount,
    digestCount: clusterResults.length,
    transformAttemptedCount,
    transformSucceededCount,
    transformFailedCount,
    clusters: clusterResults,
  }
}
