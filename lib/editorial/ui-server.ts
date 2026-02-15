import {getArticleListForApi, getHomeFeedData} from '@/lib/articles/server'
import {classifyEditorialFocus, editorialFocusScoreBoost, type EditorialFocusBucket} from '@/lib/editorial/focus'
import {fetchSemaphorSecurityStories} from '@/lib/editorial/semaphor-security'
import {getImageDisplayAssessment, type ImageDisplayAssessment} from '@/lib/editorial/sightengine'
import {createOptionalSanityServerClient} from '@/lib/sanity/client'
import {createOptionalSupabaseServerClient} from '@/lib/supabase/server'
import {isLowValueTopicLabel} from '@/lib/topics/quality'
import {curatedTopicTaxonomy} from '@/lib/topics/taxonomy'
import {sanitizeHeadlineText, sanitizePlainText} from '@/lib/utils'

import type {
  EditorialSource,
  CuratedHomeForYouRail,
  CuratedHomePayload,
  CuratedReviewStatus,
  CuratedRiskLevel,
  StoryFeedBlock,
  CuratedStoryCard,
  CuratedStoryDetail,
  CuratedSourceLink,
  EvidenceBlock,
} from './ui-types'
import {
  HOMEPAGE_MAX_STORIES_PER_SOURCE,
  resolveEditorialSourceRole,
  sourceRoleScoreAdjustment,
  summarizeCurationFromLinks,
} from './curation'

type StoryDigestDoc = {
  clusterKey: string
  topicLabel: string | null
  headline: string
  dek: string | null
  whyItMatters: string | null
  riskLevel: CuratedRiskLevel | null
  citationCount: number | null
  generationMode: 'deterministic' | 'transform' | null
  reviewStatus: CuratedReviewStatus | null
  isCongestedCluster: boolean | null
  generatedAt: string | null
  citations:
    | Array<{
        articleId: string
        sourceName: string
        url: string
        headline: string
        sourceRole: CuratedSourceLink['sourceRole'] | null
      }>
    | null
  hasOfficialSource: boolean | null
  reportingCount: number | null
  analysisCount: number | null
  officialCount: number | null
  opinionCount: number | null
  pressReleaseDriven: boolean | null
  opinionLimited: boolean | null
  sourceDiversity: number | null
}

type SemaphorNewsItemDoc = {
  articleId: string
  clusterKey: string | null
  title: string
  summary: string | null
  fullText: string | null
  fullTextExcerpt: string | null
  articleUrl: string
  sourceId: string | null
  sourceName: string | null
  sourceBadge: string | null
  sourceCategory: string | null
  publishedAt: string | null
  fetchedAt: string | null
  contentFetchStatus: string | null
  leadImageUrl: string | null
  canonicalImageUrl: string | null
  syncedAt: string | null
  topics:
    | Array<{
        label: string
        isPrimary: boolean | null
      }>
    | null
}

type IngestedArticleRow = {
  id: string
  title: string
  summary: string | null
  full_text: string | null
  full_text_excerpt: string | null
  lead_image_url: string | null
  canonical_image_url: string | null
  source_name: string
  source_id: string
  source_category: string
  source_badge: string
  article_url: string
  published_at: string | null
  fetched_at: string
}

type StoryClusterRow = {
  id: string
  cluster_key: string
  headline: string
  topic_label: string | null
  congestion_score: number | null
  is_congested: boolean | null
  generation_mode: 'deterministic' | 'transform' | null
  review_status: CuratedReviewStatus | null
  last_generated_at: string | null
}

type ClusterMemberRow = {
  article_id: string
  is_representative: boolean
  similarity: number | null
}

type StoryTopicRow = {
  article_id: string
  topic_id: string
  topics:
    | {
        id: string
        slug: string
        label: string
        topic_type: string
      }
    | Array<{
        id: string
        slug: string
        label: string
        topic_type: string
      }>
    | null
}

type StoryTopicFollowRow = {
  topic_id: string
}

type HomeOptions = {
  limit?: number
  fallbackRaw?: boolean
  preview?: boolean
  userId?: string | null
}

type StoryDetailOptions = {
  offset?: number
  limit?: number
  preview?: boolean
  userId?: string | null
}

const DEFAULT_HOME_STORIES = 24
const DEFAULT_EVIDENCE_BATCH = 8
const MAX_EVIDENCE_BATCH = 24
const SANITY_DIGEST_LIMIT = 350
const STORY_FEED_MIN_WORDS = 150
const STORY_FEED_MAX_WORDS = 400
const IMAGE_ASSESSMENT_BATCH_SIZE = 6
const TOP_HOME_IMAGES = 5
const FOR_YOU_STORY_LIMIT = 10
const SEMAPHOR_SOURCE_ID = 'semafor-security'
const STORY_TOPIC_LIMIT = 8
const taxonomyStoryTopicSlugs = new Set(curatedTopicTaxonomy.map((topic) => topic.slug))
const SANITY_DIGEST_PROJECTION = `{
  clusterKey,
  topicLabel,
  headline,
  dek,
  whyItMatters,
  riskLevel,
  citationCount,
  generationMode,
  reviewStatus,
  isCongestedCluster,
  generatedAt,
  citations[]{articleId, sourceName, url, headline, sourceRole},
  hasOfficialSource,
  reportingCount,
  analysisCount,
  officialCount,
  opinionCount,
  pressReleaseDriven,
  opinionLimited,
  sourceDiversity
}`
const SANITY_SEMAPHOR_NEWS_ITEM_PROJECTION = `{
  articleId,
  clusterKey,
  title,
  summary,
  fullText,
  fullTextExcerpt,
  articleUrl,
  sourceId,
  sourceName,
  sourceBadge,
  sourceCategory,
  publishedAt,
  fetchedAt,
  contentFetchStatus,
  leadImageUrl,
  canonicalImageUrl,
  syncedAt,
  topics[]{label, isPrimary}
}`

type HomeCardCandidate = CuratedStoryCard & {
  topicLabel?: string
  focusBucket: EditorialFocusBucket
}

function asBoolean(value: string | null | undefined, fallback = false) {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

function resolvePreviewMode(value: boolean | undefined) {
  if (typeof value === 'boolean') {
    return value
  }

  return asBoolean(process.env.EDITORIAL_SANITY_PREVIEW_DRAFTS, false)
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function compact(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  return sanitizePlainText(value).replace(/\s+/g, ' ').trim()
}

function shortText(value: string, max = 220) {
  const clean = compact(value)

  if (clean.length <= max) {
    return clean
  }

  return `${clean.slice(0, max - 1).trimEnd()}…`
}

function firstSentence(value: string, max = 140) {
  const clean = compact(value)

  if (!clean) {
    return ''
  }

  const sentence = clean.split(/(?<=[.!?])\s+/)[0] ?? clean
  return shortText(sentence, max)
}

function isLowQualityNarrative(value: string, minCharacters = 60) {
  const clean = compact(value)

  if (!clean) {
    return true
  }

  if (clean.length < minCharacters) {
    return true
  }

  return [
    /coverage update available/i,
    /read full text/i,
    /defense coverage from source reporting/i,
    /no summary provided/i,
    /general defense update/i,
  ].some((pattern) => pattern.test(clean))
}

function deriveRowSummaryText(
  row: Pick<IngestedArticleRow, 'summary' | 'full_text_excerpt'> & {
    full_text?: string | null
  },
  max = 260
) {
  const summary = shortText(row.summary ?? row.full_text_excerpt ?? '', max)

  if (summary) {
    return summary
  }

  return firstSentence(row.full_text ?? '', max)
}

function deriveNarrativeFromRows(
  rows: Array<
    Pick<IngestedArticleRow, 'summary' | 'full_text_excerpt'> & {
      full_text?: string | null
    }
  >,
  max = 260
) {
  for (const row of rows) {
    const candidate = deriveRowSummaryText(row, max)

    if (!isLowQualityNarrative(candidate, 46)) {
      return candidate
    }
  }

  for (const row of rows) {
    const candidate = deriveRowSummaryText(row, max)

    if (candidate) {
      return candidate
    }
  }

  return ''
}

function selectNarrativeText(input: {
  primary: string | null | undefined
  fallback: string | null | undefined
  max: number
  minCharacters?: number
}) {
  const primary = shortText(input.primary ?? '', input.max)

  if (!isLowQualityNarrative(primary, input.minCharacters ?? 60)) {
    return primary
  }

  const fallback = shortText(input.fallback ?? '', input.max)

  if (fallback) {
    return fallback
  }

  return primary
}

function asRiskLevel(value: string | null | undefined): CuratedRiskLevel {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value
  }

  return 'medium'
}

function asReviewStatus(value: CuratedReviewStatus | null | undefined): CuratedReviewStatus {
  if (value === 'needs_review' || value === 'approved' || value === 'published') {
    return value
  }

  return 'needs_review'
}

function asSourceRole(value: string | null | undefined): CuratedSourceLink['sourceRole'] {
  if (value === 'reporting' || value === 'analysis' || value === 'official' || value === 'opinion') {
    return value
  }

  return 'reporting'
}

function computeCardScore(input: {
  publishedAt: string | null
  citationCount: number
  congestionScore?: number | null
  isCongestedCluster?: boolean | null
  leadSourceRole?: CuratedSourceLink['sourceRole']
  hasOfficialSource?: boolean
  reportingCount?: number
  opinionCount?: number
}) {
  const recencyComponent = parseTimestamp(input.publishedAt)
  const citationComponent = Math.min(20, input.citationCount) * 1_000
  const congestionComponent = Math.round(Math.max(0, Number(input.congestionScore ?? 0)) * 10_000)
  const congestedBoost = input.isCongestedCluster ? 5_000 : 0
  const roleAdjustment = sourceRoleScoreAdjustment(input.leadSourceRole ?? 'reporting')
  const officialBonus = input.hasOfficialSource ? 1_400 : 0
  const reportingBonus = Math.max(0, input.reportingCount ?? 0) * 450
  const opinionPenalty = Math.max(0, input.opinionCount ?? 0) * 1_100

  return recencyComponent + citationComponent + congestionComponent + congestedBoost + roleAdjustment + officialBonus + reportingBonus - opinionPenalty
}

function normalizeTopicLabel(value: string | null | undefined) {
  const label = compact(value)

  if (!label) {
    return 'General defense'
  }

  return label
}

function resolveStoryTopic(value: StoryTopicRow['topics']) {
  if (!value) {
    return null
  }

  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value
}

function isDisplayEligibleStoryTopic(topic: {
  slug: string
  label: string
  articleCount: number
  followed: boolean
}) {
  if (!topic.label || isLowValueTopicLabel(topic.label)) {
    return false
  }

  return taxonomyStoryTopicSlugs.has(topic.slug)
}

export function mapStoryTopicsForDetail(input: {
  topicRows: Array<{articleId: string; id: string; slug: string; label: string}>
  followedTopicIds: Set<string>
  limit?: number
}) {
  const aggregated = new Map<string, {id: string; slug: string; label: string; articleIds: Set<string>; followed: boolean}>()

  for (const row of input.topicRows) {
    const existing = aggregated.get(row.id)

    if (!existing) {
      aggregated.set(row.id, {
        id: row.id,
        slug: row.slug,
        label: normalizeTopicLabel(row.label),
        articleIds: new Set([row.articleId]),
        followed: input.followedTopicIds.has(row.id),
      })
      continue
    }

    existing.articleIds.add(row.articleId)
    existing.followed = input.followedTopicIds.has(row.id)
  }

  const limit = Math.max(1, input.limit ?? STORY_TOPIC_LIMIT)

  return [...aggregated.values()]
    .map((topic) => ({
      id: topic.id,
      slug: topic.slug,
      label: topic.label,
      articleCount: topic.articleIds.size,
      followed: topic.followed,
    }))
    .filter((topic) => isDisplayEligibleStoryTopic(topic))
    .sort((left, right) => {
      if (left.followed !== right.followed) {
        return Number(right.followed) - Number(left.followed)
      }

      return right.articleCount - left.articleCount || left.label.localeCompare(right.label)
    })
    .slice(0, limit)
}

async function buildStoryTopicsForDetail(input: {
  articleIds: string[]
  userId?: string | null
}) {
  const articleIds = [...new Set(input.articleIds.map((id) => id.trim()).filter(Boolean))]

  if (articleIds.length === 0) {
    return [] as CuratedStoryDetail['topics']
  }

  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return [] as CuratedStoryDetail['topics']
  }

  const [{data: topicRows, error: topicError}, followResult] = await Promise.all([
    supabase
      .from('article_topics')
      .select('article_id, topic_id, topics(id, slug, label, topic_type)')
      .in('article_id', articleIds)
      .returns<StoryTopicRow[]>(),
    input.userId
      ? supabase
          .from('user_topic_follows')
          .select('topic_id')
          .eq('user_id', input.userId)
          .returns<StoryTopicFollowRow[]>()
      : Promise.resolve({data: [] as StoryTopicFollowRow[], error: null}),
  ])

  if (topicError || !topicRows) {
    logEditorialUiEvent('warn', 'story_detail_topics_fetch_failed', {
      message: topicError?.message ?? 'No topic rows returned.',
      articleCount: articleIds.length,
    })
    return [] as CuratedStoryDetail['topics']
  }

  const followedTopicIds = new Set<string>((followResult.data ?? []).map((row) => row.topic_id))
  const flattenedTopicRows = topicRows
    .map((row) => {
      const resolved = resolveStoryTopic(row.topics)

      if (!resolved) {
        return null
      }

      return {
        articleId: row.article_id,
        id: resolved.id,
        slug: resolved.slug,
        label: normalizeTopicLabel(resolved.label),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  return mapStoryTopicsForDetail({
    topicRows: flattenedTopicRows,
    followedTopicIds,
    limit: STORY_TOPIC_LIMIT,
  })
}

function normalizeEvidenceBatchSize(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_EVIDENCE_BATCH
  }

  const bounded = Math.max(DEFAULT_EVIDENCE_BATCH, Math.min(Math.trunc(value), MAX_EVIDENCE_BATCH))
  return Math.max(DEFAULT_EVIDENCE_BATCH, Math.floor(bounded / DEFAULT_EVIDENCE_BATCH) * DEFAULT_EVIDENCE_BATCH)
}

function resolveArticleRowImageUrl(row: Pick<IngestedArticleRow, 'lead_image_url' | 'canonical_image_url'>) {
  return row.canonical_image_url ?? row.lead_image_url ?? null
}

function resolveArticleCardImageUrl(article: Awaited<ReturnType<typeof getArticleListForApi>>[number]) {
  return article.canonicalImageUrl ?? article.leadImageUrl ?? null
}

const HIGH_RELEVANCE_PATTERNS = [
  /\bmissile\b/i,
  /\bdrone\b/i,
  /\bfighter\b/i,
  /\bbomber\b/i,
  /\btank\b/i,
  /\bwarship\b/i,
  /\bnavy\b/i,
  /\bair force\b/i,
  /\barmy\b/i,
  /\bmarine\b/i,
  /\bcarrier\b/i,
  /\bartillery\b/i,
  /\bradar\b/i,
  /\bsatellite\b/i,
  /\bintercept\b/i,
  /\bexercise\b/i,
  /\bdeployment\b/i,
  /\bcommander\b/i,
  /\bsecretary\b/i,
  /\bgeneral\b/i,
  /\badmiral\b/i,
  /\bminister\b/i,
]

const MEDIUM_RELEVANCE_PATTERNS = [
  /\bdefense\b/i,
  /\bsecurity\b/i,
  /\bpentagon\b/i,
  /\bmilitary\b/i,
  /\bcontract\b/i,
  /\baward\b/i,
  /\bboeing\b/i,
  /\blockheed\b/i,
  /\braytheon\b/i,
  /\bnorthrop\b/i,
  /\bgeneral dynamics\b/i,
  /\banduril\b/i,
  /\bl3harris\b/i,
  /\bpalantir\b/i,
]

function clampUnit(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(1, Math.max(0, value))
}

function scorePatternMatches(text: string, patterns: RegExp[]) {
  let count = 0

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      count += 1
    }
  }

  return count
}

function scoreDefenseImageRelevance(text: string) {
  const clean = compact(text)

  if (!clean) {
    return 0.1
  }

  const highMatches = scorePatternMatches(clean, HIGH_RELEVANCE_PATTERNS)
  const mediumMatches = scorePatternMatches(clean, MEDIUM_RELEVANCE_PATTERNS)
  const raw = 0.18 + highMatches * 0.16 + mediumMatches * 0.08

  return clampUnit(raw)
}

function scoreHomeCardImageRelevance(card: HomeCardCandidate) {
  const text = [card.headline, card.dek, card.whyItMatters, card.sourceName, card.topicLabel ?? ''].join(' ')
  let score = scoreDefenseImageRelevance(text)

  if (card.riskLevel === 'high') {
    score += 0.1
  } else if (card.riskLevel === 'medium') {
    score += 0.05
  }

  if (card.hasOfficialSource || card.reportingCount > 0) {
    score += 0.05
  }

  return clampUnit(score)
}

function scoreStoryHeroImageRelevance(input: {
  headline: string
  dek: string
  whyItMatters: string
  riskLevel?: CuratedRiskLevel
}) {
  let score = scoreDefenseImageRelevance(`${input.headline} ${input.dek} ${input.whyItMatters}`)

  if (input.riskLevel === 'high') {
    score += 0.1
  }

  return clampUnit(score)
}

function scoreFeedBlockImageRelevance(headline: string, body: string) {
  const base = scoreDefenseImageRelevance(`${headline} ${body}`)
  return clampUnit(base)
}

async function resolveImageAssessmentsByKey(
  requests: Array<{
    key: string
    imageUrl: string | null | undefined
    relevanceScore: number
  }>
) {
  if (requests.length === 0) {
    return new Map<string, ImageDisplayAssessment>()
  }

  const assessments = new Map<string, ImageDisplayAssessment>()

  for (let index = 0; index < requests.length; index += IMAGE_ASSESSMENT_BATCH_SIZE) {
    const batch = requests.slice(index, index + IMAGE_ASSESSMENT_BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (request) => {
        const assessment = await getImageDisplayAssessment({
          imageUrl: request.imageUrl,
          relevanceScore: request.relevanceScore,
        })

        return [request.key, assessment] as const
      })
    )

    for (const [key, assessment] of batchResults) {
      assessments.set(key, assessment)
    }
  }

  return assessments
}

async function filterHomeCardImages(cards: HomeCardCandidate[]) {
  if (cards.length === 0) {
    return cards
  }

  const requests = cards.map((card, index) => ({
    key: `home-${index}`,
    imageUrl: card.imageUrl,
    relevanceScore: scoreHomeCardImageRelevance(card),
  }))
  const assessmentByKey = await resolveImageAssessmentsByKey(requests)

  const rankedCandidates = cards
    .map((card, index) => {
      const imageUrl = card.imageUrl?.trim()

      if (!imageUrl) {
        return null
      }

      const assessment = assessmentByKey.get(`home-${index}`)

      if (!assessment?.shouldDisplay) {
        return null
      }

      const qualityScore = typeof assessment.qualityScore === 'number' ? assessment.qualityScore : 0
      const aiGeneratedScore = typeof assessment.aiGeneratedScore === 'number' ? assessment.aiGeneratedScore : 1
      const rankingScore = assessment.relevanceScore * 1000 + qualityScore * 220 - aiGeneratedScore * 150 + (index === 0 ? 90 : 0)

      return {
        index,
        imageUrl,
        rankingScore,
      }
    })
    .filter((value): value is {index: number; imageUrl: string; rankingScore: number} => Boolean(value))
    .sort((left, right) => right.rankingScore - left.rankingScore || left.index - right.index)

  const selectedImageIndexes = new Set<number>()
  const leadCandidate = rankedCandidates.find((candidate) => candidate.index === 0)

  if (leadCandidate) {
    selectedImageIndexes.add(leadCandidate.index)
  }

  for (const candidate of rankedCandidates) {
    if (selectedImageIndexes.size >= TOP_HOME_IMAGES) {
      break
    }

    selectedImageIndexes.add(candidate.index)
  }

  return cards.map((card, index) => {
    if (!card.imageUrl) {
      return card
    }

    const imageUrl = card.imageUrl.trim()

    if (!imageUrl) {
      return {
        ...card,
        imageUrl: null,
      }
    }

    if (selectedImageIndexes.has(index)) {
      if (imageUrl === card.imageUrl) {
        return card
      }

      return {
        ...card,
        imageUrl,
      }
    }

    return {
      ...card,
      imageUrl: null,
    }
  })
}

async function filterStoryDetailImages(input: {
  headline: string
  dek: string
  whyItMatters: string
  riskLevel: CuratedRiskLevel
  heroImageUrl: string | null
  feedBlocks: StoryFeedBlock[]
}) {
  const requests = [
    {
      key: 'hero',
      imageUrl: input.heroImageUrl,
      relevanceScore: scoreStoryHeroImageRelevance({
        headline: input.headline,
        dek: input.dek,
        whyItMatters: input.whyItMatters,
        riskLevel: input.riskLevel,
      }),
    },
    ...input.feedBlocks.map((block, index) => ({
      key: `feed-${index}`,
      imageUrl: block.imageUrl,
      relevanceScore: scoreFeedBlockImageRelevance(input.headline, block.body),
    })),
  ]
  const assessmentByKey = await resolveImageAssessmentsByKey(requests)

  const normalizedHeroImageUrl = input.heroImageUrl?.trim() ?? null
  const heroImageUrl =
    normalizedHeroImageUrl && assessmentByKey.get('hero')?.shouldDisplay ? normalizedHeroImageUrl : null
  const seenImageUrls = new Set<string>(heroImageUrl ? [heroImageUrl] : [])
  let visibleInlineImages = 0

  const feedBlocks = input.feedBlocks.map((block, index) => {
    if (!block.imageUrl) {
      return block
    }

    const imageUrl = block.imageUrl.trim()

    if (!imageUrl) {
      return {
        ...block,
        imageUrl: null,
        imageAlt: null,
      }
    }

    if (!assessmentByKey.get(`feed-${index}`)?.shouldDisplay || seenImageUrls.has(imageUrl) || visibleInlineImages >= 2) {
      return {
        ...block,
        imageUrl: null,
        imageAlt: null,
      }
    }

    seenImageUrls.add(imageUrl)
    visibleInlineImages += 1

    if (assessmentByKey.get(`feed-${index}`)?.shouldDisplay) {
      if (imageUrl === block.imageUrl) {
        return block
      }

      return {
        ...block,
        imageUrl,
      }
    }

    return {
      ...block,
      imageUrl: null,
      imageAlt: null,
    }
  })

  return {
    heroImageUrl,
    feedBlocks,
  }
}

function countWords(value: string) {
  return value.split(/\s+/).filter(Boolean).length
}

function splitSentences(value: string) {
  const clean = compact(value)

  if (!clean) {
    return [] as string[]
  }

  const boilerplatePatterns = [
    /newsletter/i,
    /subscribe/i,
    /all rights reserved/i,
    /reprinted by permission/i,
    /contact the author/i,
    /follow us on/i,
    /advertisement/i,
    /sign up/i,
  ]

  return clean
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      if (!sentence) {
        return false
      }

      return !boilerplatePatterns.some((pattern) => pattern.test(sentence))
    })
}

function chunkSentenceByWords(sentence: string, maxWords: number) {
  const words = sentence.split(/\s+/).filter(Boolean)

  if (words.length <= maxWords) {
    return [sentence]
  }

  const chunks: string[] = []
  for (let index = 0; index < words.length; index += maxWords) {
    chunks.push(words.slice(index, index + maxWords).join(' '))
  }

  return chunks
}

function chunkNarrativeText(
  text: string,
  options?: {
    minWords?: number
    maxWords?: number
  }
) {
  const minWords = Math.max(60, options?.minWords ?? STORY_FEED_MIN_WORDS)
  const maxWords = Math.max(minWords, options?.maxWords ?? STORY_FEED_MAX_WORDS)
  const sentences = splitSentences(text)

  if (sentences.length === 0) {
    return [] as string[]
  }

  const blocks: string[] = []
  let currentSentences: string[] = []
  let currentWords = 0

  function flushCurrent() {
    if (currentSentences.length === 0) {
      return
    }

    const body = currentSentences.join(' ').trim()
    if (body) {
      blocks.push(body)
    }

    currentSentences = []
    currentWords = 0
  }

  for (const sentence of sentences) {
    const sentenceChunks = chunkSentenceByWords(sentence, maxWords)

    for (const chunk of sentenceChunks) {
      const chunkWords = countWords(chunk)

      if (chunkWords === 0) {
        continue
      }

      if (currentWords + chunkWords > maxWords && currentWords >= minWords) {
        flushCurrent()
      }

      currentSentences.push(chunk)
      currentWords += chunkWords

      if (currentWords >= maxWords) {
        flushCurrent()
      }
    }
  }

  flushCurrent()

  if (blocks.length > 1) {
    const last = blocks[blocks.length - 1]
    const previous = blocks[blocks.length - 2]
    const lastWords = countWords(last)
    const previousWords = countWords(previous)

    if (lastWords < minWords) {
      const combinedWords = `${previous} ${last}`.trim().split(/\s+/).filter(Boolean)

      if (combinedWords.length >= minWords * 2 && combinedWords.length <= maxWords * 2) {
        let splitIndex = Math.ceil(combinedWords.length / 2)

        splitIndex = Math.max(minWords, Math.min(splitIndex, maxWords))

        if (combinedWords.length - splitIndex < minWords) {
          splitIndex = Math.max(minWords, combinedWords.length - minWords)
        }

        if (splitIndex < combinedWords.length) {
          const nextPrevious = combinedWords.slice(0, splitIndex).join(' ').trim()
          const nextLast = combinedWords.slice(splitIndex).join(' ').trim()

          if (
            countWords(nextPrevious) >= minWords &&
            countWords(nextLast) >= minWords &&
            countWords(nextPrevious) <= maxWords &&
            countWords(nextLast) <= maxWords
          ) {
            blocks.splice(blocks.length - 2, 2, nextPrevious, nextLast)
          }
        }
      } else if (previousWords + lastWords <= maxWords + 40) {
        blocks.splice(blocks.length - 2, 2, `${previous} ${last}`.trim())
      }
    }
  }

  return blocks
}

function logEditorialUiEvent(level: 'info' | 'warn', event: string, details?: Record<string, unknown>) {
  const payload = details ? {event, ...details} : {event}

  if (level === 'warn') {
    console.warn('[editorial-ui]', payload)
    return
  }

  console.info('[editorial-ui]', payload)
}

function dedupeSourceLinks(links: CuratedSourceLink[], max = 4) {
  const seen = new Set<string>()
  const unique: CuratedSourceLink[] = []

  for (const link of links) {
    const key = `${link.sourceName}|${link.url}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    unique.push(link)

    if (unique.length >= max) {
      break
    }
  }

  return unique
}

const attributionTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatAttributionTimestamp(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return attributionTimeFormatter.format(parsed)
}

function sourceRoleMixLabel(links: CuratedSourceLink[]) {
  const roles = new Set<CuratedSourceLink['sourceRole']>()

  for (const link of links) {
    roles.add(link.sourceRole)
  }

  if (roles.size === 0) {
    return 'Mixed sources'
  }

  const orderedRoles: CuratedSourceLink['sourceRole'][] = ['reporting', 'official', 'analysis', 'opinion']
  const labels = orderedRoles
    .filter((role) => roles.has(role))
    .map((role) => {
      if (role === 'official') {
        return 'Official'
      }

      if (role === 'analysis') {
        return 'Analysis'
      }

      if (role === 'opinion') {
        return 'Opinion'
      }

      return 'Reporting'
    })

  if (labels.length === 1) {
    return labels[0] ?? 'Mixed sources'
  }

  if (labels.length === 2) {
    return `${labels[0]} + ${labels[1]}`
  }

  return `${labels[0]} + mixed`
}

function buildStoryAttributionLine(input: {
  sourceLinks: CuratedSourceLink[]
  citationCount: number
  publishedAt: string
}) {
  const sourceMix = sourceRoleMixLabel(input.sourceLinks)
  const citationText = `${Math.max(1, input.citationCount)} source${input.citationCount === 1 ? '' : 's'}`
  const updatedText = `Updated ${formatAttributionTimestamp(input.publishedAt)}`

  return `${sourceMix} · ${citationText} · ${updatedText}`
}

function mapDigestToCard(digest: StoryDigestDoc): CuratedStoryCard {
  const publishedAt = digest.generatedAt ?? new Date().toISOString()
  const sourceLinks = dedupeSourceLinks(
    (digest.citations ?? []).map((citation) => ({
      articleId: citation.articleId,
      sourceName: citation.sourceName,
      url: citation.url,
      headline: sanitizeHeadlineText(citation.headline),
      sourceRole: asSourceRole(citation.sourceRole),
    }))
  )
  const inferredCuration = summarizeCurationFromLinks({
    links: sourceLinks,
    pressReleaseDriven: digest.pressReleaseDriven ?? false,
    opinionLimited: digest.opinionLimited ?? false,
  })
  const hasOfficialSource = digest.hasOfficialSource ?? inferredCuration.hasOfficialSource
  const reportingCount = Math.max(0, Number(digest.reportingCount ?? inferredCuration.reportingCount))
  const analysisCount = Math.max(0, Number(digest.analysisCount ?? inferredCuration.analysisCount))
  const officialCount = Math.max(0, Number(digest.officialCount ?? inferredCuration.officialCount))
  const opinionCount = Math.max(0, Number(digest.opinionCount ?? inferredCuration.opinionCount))
  const pressReleaseDriven = Boolean(digest.pressReleaseDriven ?? inferredCuration.pressReleaseDriven)
  const opinionLimited = Boolean(digest.opinionLimited ?? inferredCuration.opinionLimited)
  const sourceDiversity = Math.max(1, Number(digest.sourceDiversity ?? inferredCuration.sourceDiversity))
  const leadRole = sourceLinks[0]?.sourceRole ?? 'reporting'

  return {
    clusterKey: digest.clusterKey,
    headline: sanitizeHeadlineText(digest.headline),
    dek: shortText(digest.dek ?? '', 220),
    whyItMatters: shortText(digest.whyItMatters ?? '', 140),
    riskLevel: asRiskLevel(digest.riskLevel),
    citationCount: Math.max(0, Number(digest.citationCount ?? sourceLinks.length)),
    generationMode: digest.generationMode === 'transform' ? 'transform' : 'deterministic',
    reviewStatus: asReviewStatus(digest.reviewStatus),
    isCongestedCluster: Boolean(digest.isCongestedCluster),
    publishedAt,
    sourceName: sourceLinks[0]?.sourceName ?? 'Multiple sources',
    imageUrl: null,
    sourceLinks,
    hasOfficialSource,
    reportingCount,
    analysisCount,
    officialCount,
    opinionCount,
    pressReleaseDriven,
    opinionLimited,
    sourceDiversity,
    score: computeCardScore({
      publishedAt,
      citationCount: Number(digest.citationCount ?? sourceLinks.length),
      congestionScore: null,
      isCongestedCluster: digest.isCongestedCluster,
      leadSourceRole: leadRole,
      hasOfficialSource,
      reportingCount,
      opinionCount,
    }),
  }
}

function deriveRiskFromText(text: string): CuratedRiskLevel {
  const normalized = text.toLowerCase()

  if (/(nuclear|strike|warhead|deterrence|missile|conflict|escalation|attack)/.test(normalized)) {
    return 'high'
  }

  if (/(deployment|exercise|procurement|security|drone|air defense|readiness)/.test(normalized)) {
    return 'medium'
  }

  return 'low'
}

function mapRawArticleToCard(article: Awaited<ReturnType<typeof getArticleListForApi>>[number]): CuratedStoryCard {
  const publishedAt = article.publishedAt ?? article.fetchedAt
  const topicLabel = article.topics[0]?.label ?? 'General defense'
  const sourceRole = resolveEditorialSourceRole({
    sourceId: article.sourceId,
    sourceName: article.sourceName,
    sourceBadge: article.sourceBadge,
    title: article.title,
  })
  const sourceLinks: CuratedSourceLink[] = [
    {
      articleId: article.id,
      sourceName: article.sourceName,
      url: article.articleUrl,
      headline: sanitizeHeadlineText(article.title),
      sourceRole,
    },
  ]
  const curation = summarizeCurationFromLinks({
    links: sourceLinks,
    pressReleaseDriven: sourceRole === 'official',
    opinionLimited: false,
  })

  return {
    clusterKey: `raw-${article.id}`,
    headline: sanitizeHeadlineText(article.title),
    dek: shortText(article.summary ?? article.fullTextExcerpt ?? '', 220),
    whyItMatters: firstSentence(article.summary ?? article.fullTextExcerpt ?? `${topicLabel} update from ${article.sourceName}.`, 140),
    riskLevel: deriveRiskFromText(`${article.title} ${article.summary ?? ''}`),
    citationCount: 1,
    generationMode: 'deterministic',
    reviewStatus: 'published',
    isCongestedCluster: false,
    publishedAt,
    sourceName: article.sourceName,
    imageUrl: resolveArticleCardImageUrl(article),
    sourceLinks,
    hasOfficialSource: curation.hasOfficialSource,
    reportingCount: curation.reportingCount,
    analysisCount: curation.analysisCount,
    officialCount: curation.officialCount,
    opinionCount: curation.opinionCount,
    pressReleaseDriven: curation.pressReleaseDriven,
    opinionLimited: curation.opinionLimited,
    sourceDiversity: curation.sourceDiversity,
    score: computeCardScore({
      publishedAt,
      citationCount: 1,
      leadSourceRole: sourceRole,
      hasOfficialSource: curation.hasOfficialSource,
      reportingCount: curation.reportingCount,
      opinionCount: curation.opinionCount,
    }),
  }
}

async function attachCardImagesFromSupabase(cards: HomeCardCandidate[]) {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase || cards.length === 0) {
    return cards
  }

  const primaryArticleIds = [...new Set(cards.map((card) => card.sourceLinks[0]?.articleId).filter((value): value is string => Boolean(value)))]

  if (primaryArticleIds.length === 0) {
    return cards
  }

  const {data} = await supabase
    .from('ingested_articles')
    .select('id, lead_image_url, canonical_image_url, summary, full_text_excerpt')
    .in('id', primaryArticleIds)
    .returns<
      Array<{
        id: string
        lead_image_url: string | null
        canonical_image_url: string | null
        summary: string | null
        full_text_excerpt: string | null
      }>
    >()

  const metadataByArticleId = new Map((data ?? []).map((row) => [row.id, row] as const))

  return cards.map((card) => {
    const primaryArticleId = card.sourceLinks[0]?.articleId

    if (!primaryArticleId) {
      return card
    }

    const row = metadataByArticleId.get(primaryArticleId)

    if (!row) {
      return card
    }

    const imageUrl = row.canonical_image_url ?? row.lead_image_url ?? null
    const fallbackDek = deriveRowSummaryText(row, 220)
    const fallbackWhy = firstSentence(row.summary ?? row.full_text_excerpt ?? fallbackDek, 140)

    return {
      ...card,
      imageUrl: imageUrl ?? card.imageUrl,
      dek: selectNarrativeText({
        primary: card.dek,
        fallback: fallbackDek,
        max: 220,
        minCharacters: 70,
      }),
      whyItMatters: selectNarrativeText({
        primary: card.whyItMatters,
        fallback: fallbackWhy,
        max: 140,
        minCharacters: 45,
      }),
    }
  })
}

async function fetchSanityDigestCards(options?: {preview?: boolean}) {
  const sanity = createOptionalSanityServerClient()

  if (!sanity) {
    return [] as HomeCardCandidate[]
  }

  const preview = resolvePreviewMode(options?.preview)
  let digests: StoryDigestDoc[] = []

  if (preview) {
    const [draftDigests, publishedDigests] = await Promise.all([
      sanity.fetch<StoryDigestDoc[]>(
        `*[_type == "storyDigest" && _id in path("drafts.**")]
          | order(generatedAt desc)[0...$limit]${SANITY_DIGEST_PROJECTION}`,
        {limit: SANITY_DIGEST_LIMIT}
      ),
      sanity.fetch<StoryDigestDoc[]>(
        `*[_type == "storyDigest" && !(_id in path("drafts.**"))]
          | order(generatedAt desc)[0...$limit]${SANITY_DIGEST_PROJECTION}`,
        {limit: SANITY_DIGEST_LIMIT}
      ),
    ])

    const byClusterKey = new Map<string, StoryDigestDoc>()

    for (const digest of draftDigests ?? []) {
      if (!digest.clusterKey) {
        continue
      }

      byClusterKey.set(digest.clusterKey, digest)
    }

    for (const digest of publishedDigests ?? []) {
      if (!digest.clusterKey || byClusterKey.has(digest.clusterKey)) {
        continue
      }

      byClusterKey.set(digest.clusterKey, digest)
    }

    digests = [...byClusterKey.values()]
      .sort((left, right) => parseTimestamp(right.generatedAt) - parseTimestamp(left.generatedAt))
      .slice(0, SANITY_DIGEST_LIMIT)
  } else {
    digests =
      (await sanity.fetch<StoryDigestDoc[]>(
        `*[_type == "storyDigest" && !(_id in path("drafts.**"))]
          | order(generatedAt desc)[0...$limit]${SANITY_DIGEST_PROJECTION}`,
        {limit: SANITY_DIGEST_LIMIT}
      )) ?? []
  }

  const cards = (digests ?? []).map((digest) => {
    const topicLabel = normalizeTopicLabel(digest.topicLabel)
    const card = mapDigestToCard(digest)
    const focusBucket = classifyEditorialFocus({
      title: card.headline,
      summary: `${card.dek} ${card.whyItMatters}`.trim(),
      topicLabel,
    })

    return {
      ...card,
      topicLabel,
      focusBucket,
      score: card.score + editorialFocusScoreBoost(focusBucket),
    } satisfies HomeCardCandidate
  })

  return attachCardImagesFromSupabase(cards)
}

async function fetchRawFallbackCards(limit: number) {
  const rawArticles = await getArticleListForApi({
    limit: Math.max(limit, 24),
    offset: 0,
  })

  return rawArticles.map((article) => {
    const topicLabel = normalizeTopicLabel(article.topics[0]?.label ?? null)
    const card = mapRawArticleToCard(article)
    const focusBucket = classifyEditorialFocus({
      title: article.title,
      summary: article.summary ?? article.fullTextExcerpt,
      topicLabel,
      topics: article.topics,
    })

    return {
      ...card,
      topicLabel,
      focusBucket,
      score: card.score + editorialFocusScoreBoost(focusBucket),
    } satisfies HomeCardCandidate
  })
}

function mapSemaphorSecurityCard(story: Awaited<ReturnType<typeof fetchSemaphorSecurityStories>>[number]) {
  const sourceName = 'Semafor Security'
  const sourceLinks: CuratedSourceLink[] = [
    {
      articleId: story.id,
      sourceName,
      url: story.articleUrl,
      headline: sanitizeHeadlineText(story.headline),
      sourceRole: 'reporting',
    },
  ]

  const card: CuratedStoryCard = {
    clusterKey: story.id,
    headline: sanitizeHeadlineText(story.headline),
    dek: shortText(story.subtitle || story.headline, 220),
    whyItMatters: firstSentence(story.subtitle || story.headline, 140),
    riskLevel: deriveRiskFromText(`${story.headline} ${story.subtitle}`),
    citationCount: 1,
    generationMode: 'deterministic',
    reviewStatus: 'published',
    isCongestedCluster: false,
    publishedAt: story.publishedAt,
    sourceName,
    imageUrl: story.imageUrl,
    sourceLinks,
    hasOfficialSource: false,
    reportingCount: 1,
    analysisCount: 0,
    officialCount: 0,
    opinionCount: 0,
    pressReleaseDriven: false,
    opinionLimited: false,
    sourceDiversity: 1,
    score: computeCardScore({
      publishedAt: story.publishedAt,
      citationCount: 1,
      leadSourceRole: 'reporting',
      hasOfficialSource: false,
      reportingCount: 1,
      opinionCount: 0,
    }),
  }

  const topicLabel = 'Security'
  const inferredFocus = classifyEditorialFocus({
    title: card.headline,
    summary: `${card.dek} ${card.whyItMatters}`,
    topicLabel,
  })
  const focusBucket = inferredFocus === 'other' ? 'international' : inferredFocus

  return {
    ...card,
    topicLabel,
    focusBucket,
    score: card.score + editorialFocusScoreBoost(focusBucket),
  } satisfies HomeCardCandidate
}

function mapSemaphorNewsItemCard(newsItem: SemaphorNewsItemDoc): HomeCardCandidate | null {
  const clusterKey = compact(newsItem.clusterKey ?? newsItem.articleId)
  const articleId = compact(newsItem.articleId || clusterKey)
  const articleUrl = compact(newsItem.articleUrl)

  if (!clusterKey || !articleId || !articleUrl) {
    return null
  }

  const sourceName = compact(newsItem.sourceName) || 'Semafor Security'
  const title = sanitizeHeadlineText(compact(newsItem.title) || 'Semafor Security update')
  const summaryCandidate = compact(newsItem.summary ?? newsItem.fullTextExcerpt)
  const bodyCandidate = compact(newsItem.fullText)
  const dek = shortText(summaryCandidate || firstSentence(bodyCandidate || title, 220), 220)
  const whyItMatters = firstSentence(summaryCandidate || bodyCandidate || title, 140)
  const publishedAt = newsItem.publishedAt ?? newsItem.fetchedAt ?? newsItem.syncedAt ?? new Date().toISOString()
  const sourceLinks: CuratedSourceLink[] = [
    {
      articleId,
      sourceName,
      url: articleUrl,
      headline: title,
      sourceRole: 'reporting',
    },
  ]
  const card: CuratedStoryCard = {
    clusterKey,
    headline: title,
    dek,
    whyItMatters,
    riskLevel: deriveRiskFromText(`${title} ${summaryCandidate}`),
    citationCount: 1,
    generationMode: 'deterministic',
    reviewStatus: 'published',
    isCongestedCluster: false,
    publishedAt,
    sourceName,
    imageUrl: newsItem.leadImageUrl ?? newsItem.canonicalImageUrl,
    sourceLinks,
    hasOfficialSource: false,
    reportingCount: 1,
    analysisCount: 0,
    officialCount: 0,
    opinionCount: 0,
    pressReleaseDriven: false,
    opinionLimited: false,
    sourceDiversity: 1,
    score: computeCardScore({
      publishedAt,
      citationCount: 1,
      leadSourceRole: 'reporting',
      hasOfficialSource: false,
      reportingCount: 1,
      opinionCount: 0,
    }),
  }

  const primaryTopic = newsItem.topics?.find((topic) => topic.isPrimary)?.label ?? newsItem.topics?.[0]?.label ?? null
  const topicLabel = normalizeTopicLabel(primaryTopic ?? 'Security')
  const inferredFocus = classifyEditorialFocus({
    title: card.headline,
    summary: `${card.dek} ${card.whyItMatters}`,
    topicLabel,
  })
  const focusBucket = inferredFocus === 'other' ? 'international' : inferredFocus

  return {
    ...card,
    topicLabel,
    focusBucket,
    score: card.score + editorialFocusScoreBoost(focusBucket),
  } satisfies HomeCardCandidate
}

async function fetchSemaphorSecurityCardsFromSanity(limit: number, preview: boolean) {
  const sanity = createOptionalSanityServerClient()

  if (!sanity) {
    return [] as HomeCardCandidate[]
  }

  const query = preview
    ? `*[_type == "newsItem" && sourceId == $sourceId && contentFetchStatus == "fetched"]
        | order(coalesce(publishedAt, fetchedAt, syncedAt) desc)[0...$limit]${SANITY_SEMAPHOR_NEWS_ITEM_PROJECTION}`
    : `*[_type == "newsItem" && sourceId == $sourceId && contentFetchStatus == "fetched" && !(_id in path("drafts.**"))]
        | order(coalesce(publishedAt, fetchedAt, syncedAt) desc)[0...$limit]${SANITY_SEMAPHOR_NEWS_ITEM_PROJECTION}`

  const docs =
    (await sanity.fetch<SemaphorNewsItemDoc[]>(query, {
      sourceId: SEMAPHOR_SOURCE_ID,
      limit: Math.max(1, Math.min(limit * 3, 500)),
    })) ?? []

  const cardsByCluster = new Map<string, HomeCardCandidate>()

  for (const doc of docs) {
    const card = mapSemaphorNewsItemCard(doc)

    if (!card || cardsByCluster.has(card.clusterKey)) {
      continue
    }

    cardsByCluster.set(card.clusterKey, card)
  }

  return [...cardsByCluster.values()]
    .sort((left, right) => parseTimestamp(right.publishedAt) - parseTimestamp(left.publishedAt))
    .slice(0, limit)
}

async function fetchSemaphorSecurityCards(limit: number, options?: {preview?: boolean}) {
  const preview = options?.preview ?? false

  try {
    const fromSanity = await fetchSemaphorSecurityCardsFromSanity(limit, preview)

    if (fromSanity.length > 0) {
      return fromSanity
    }
  } catch (error) {
    logEditorialUiEvent('warn', 'home_semaphor_security_sanity_fetch_failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  try {
    const stories = await fetchSemaphorSecurityStories(limit)
    return stories.map(mapSemaphorSecurityCard)
  } catch (error) {
    logEditorialUiEvent('warn', 'home_semaphor_security_fetch_failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    return [] as HomeCardCandidate[]
  }
}

async function buildHomeStreamWithSupplementalStories(input: {
  cards: HomeCardCandidate[]
  limit: number
  source: 'sanity' | 'raw-fallback'
  preview: boolean
}) {
  const baseStories = buildHomeStoryStream(input.cards, {
    limit: input.limit,
    maxStoriesPerSource: 4,
  })

  if (baseStories.length >= input.limit) {
    return {
      stories: baseStories,
      supplemented: false,
    }
  }

  const semaphorCards = await fetchSemaphorSecurityCards(Math.max(12, input.limit * 2), {
    preview: input.preview,
  })

  if (semaphorCards.length === 0) {
    return {
      stories: baseStories,
      supplemented: false,
    }
  }

  const combinedStories = buildHomeStoryStream([...input.cards, ...semaphorCards], {
    limit: input.limit,
    maxStoriesPerSource: 8,
  })

  logEditorialUiEvent('info', 'home_semaphor_security_supplemented', {
    source: input.source,
    before: baseStories.length,
    after: combinedStories.length,
    semaphorCards: semaphorCards.length,
  })

  return {
    stories: combinedStories,
    supplemented: combinedStories.length > baseStories.length,
  }
}

export function buildHomeStoryStream(
  cards: HomeCardCandidate[],
  options?: {
    limit?: number
    maxStoriesPerSource?: number
  }
) {
  const limit = Math.max(1, Math.min(options?.limit ?? DEFAULT_HOME_STORIES, 60))
  const maxStoriesPerSource = Math.max(1, Math.min(options?.maxStoriesPerSource ?? HOMEPAGE_MAX_STORIES_PER_SOURCE, 6))
  const pool = cards.filter((card) => card.focusBucket !== 'other')

  if (pool.length === 0) {
    return []
  }

  const deduped = new Map<string, HomeCardCandidate>()
  for (const card of pool) {
    if (deduped.has(card.clusterKey)) {
      continue
    }

    deduped.set(card.clusterKey, card)
  }

  const ranked = [...deduped.values()]
    .sort((left, right) => right.score - left.score || parseTimestamp(right.publishedAt) - parseTimestamp(left.publishedAt))

  const selected: HomeCardCandidate[] = []
  const sourceCounts = new Map<string, number>()
  let opinionOnlyStories = 0

  for (const card of ranked) {
    const sourceKey = (card.sourceLinks[0]?.sourceName ?? card.sourceName).toLowerCase()
    const sourceCount = sourceCounts.get(sourceKey) ?? 0

    if (sourceCount >= maxStoriesPerSource) {
      continue
    }

    const isOpinionOnly = card.opinionCount > 0 && card.reportingCount === 0 && card.officialCount === 0

    if (isOpinionOnly && opinionOnlyStories >= 2) {
      continue
    }

    selected.push(card)
    sourceCounts.set(sourceKey, sourceCount + 1)

    if (isOpinionOnly) {
      opinionOnlyStories += 1
    }

    if (selected.length >= limit) {
      break
    }
  }

  return selected
}

function buildSemaphorHomeStoryStream(cards: HomeCardCandidate[], limit: number) {
  const deduped = new Map<string, HomeCardCandidate>()

  for (const card of cards) {
    const key = card.sourceLinks[0]?.url ?? card.clusterKey

    if (deduped.has(key)) {
      continue
    }

    deduped.set(key, card)
  }

  return [...deduped.values()]
    .sort((left, right) => parseTimestamp(right.publishedAt) - parseTimestamp(left.publishedAt) || right.score - left.score)
    .slice(0, limit)
}

type HomeFeedData = Awaited<ReturnType<typeof getHomeFeedData>>

function mapTopicToForYouTopic(topic: HomeFeedData['trendingTopics'][number]) {
  return {
    id: topic.id,
    slug: topic.slug,
    label: topic.label,
    articleCount: topic.articleCount,
    followed: topic.followed,
  }
}

async function filterForYouRailImages(stories: CuratedStoryCard[]) {
  if (stories.length === 0) {
    return stories
  }

  const [firstStory, ...rest] = stories

  if (!firstStory) {
    return stories
  }

  const relevanceScore = scoreDefenseImageRelevance(
    `${firstStory.headline} ${firstStory.dek} ${firstStory.whyItMatters} ${firstStory.sourceName}`
  )
  const assessment = await getImageDisplayAssessment({
    imageUrl: firstStory.imageUrl,
    relevanceScore,
  })

  const normalizedFirstImage = firstStory.imageUrl?.trim() ?? null
  const firstWithMedia: CuratedStoryCard = {
    ...firstStory,
    imageUrl: assessment.shouldDisplay ? normalizedFirstImage : null,
  }

  return [
    firstWithMedia,
    ...rest.map((story) => ({
      ...story,
      imageUrl: null,
    })),
  ]
}

async function buildForYouRail(input: {
  userId?: string | null
  editionStories: CuratedStoryCard[]
}): Promise<CuratedHomeForYouRail | null> {
  const homeFeed = await getHomeFeedData(input.userId)
  const followedTopicIds = new Set(homeFeed.followedTopics.map((topic) => topic.id))
  const isPersonalized = followedTopicIds.size > 0
  const topicSource = isPersonalized ? homeFeed.followedTopics : homeFeed.trendingTopics
  const topicSet = new Set(topicSource.map((topic) => topic.id))
  const editionArticleIds = new Set(input.editionStories.flatMap((story) => story.sourceLinks.map((link) => link.articleId)))
  const editionClusterKeys = new Set(input.editionStories.map((story) => story.clusterKey))
  const candidateArticles = homeFeed.articles.filter((article) => {
    if (editionArticleIds.has(article.id)) {
      return false
    }

    if (editionClusterKeys.has(`raw-${article.id}`)) {
      return false
    }

    if (topicSet.size === 0) {
      return true
    }

    return article.topics.some((topic) => topicSet.has(topic.id))
  })
  const candidateStories = candidateArticles.map(mapRawArticleToCard)
  const dedupedStories: CuratedStoryCard[] = []
  const seenClusterKeys = new Set<string>()

  for (const story of candidateStories) {
    if (seenClusterKeys.has(story.clusterKey)) {
      continue
    }

    seenClusterKeys.add(story.clusterKey)
    dedupedStories.push(story)

    if (dedupedStories.length >= FOR_YOU_STORY_LIMIT) {
      break
    }
  }

  const storiesWithMedia = await filterForYouRailImages(dedupedStories)

  return {
    title: 'For You',
    stories: storiesWithMedia,
    topics: topicSource.slice(0, 8).map(mapTopicToForYouTopic),
    isPersonalized,
    notice: isPersonalized
      ? 'From topics you follow.'
      : input.userId
        ? 'Follow topics to personalize this rail.'
        : 'Sign in and follow topics to personalize this rail.',
  }
}

async function buildHomePayload(input: {
  stories: CuratedStoryCard[]
  source: EditorialSource
  generatedAt: string
  notice: string | null
  userId?: string | null
}) {
  let forYou: CuratedHomeForYouRail | null = null

  try {
    forYou = await buildForYouRail({
      userId: input.userId,
      editionStories: input.stories,
    })
  } catch (error) {
    logEditorialUiEvent('warn', 'home_for_you_failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  return {
    stories: input.stories,
    forYou,
    source: input.source,
    generatedAt: input.generatedAt,
    notice: input.notice,
  } satisfies CuratedHomePayload
}

export async function getCuratedHomeData(options: HomeOptions = {}): Promise<CuratedHomePayload> {
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_HOME_STORIES, 120))
  const fallbackRaw = options.fallbackRaw ?? true
  const preview = resolvePreviewMode(options.preview)
  const generatedAt = new Date().toISOString()
  const semaphorCards = await fetchSemaphorSecurityCards(Math.max(90, limit * 3), {
    preview,
  })
  const stories = buildSemaphorHomeStoryStream(semaphorCards, limit)

  logEditorialUiEvent('info', 'home_semaphor_security_only', {
    requestedLimit: limit,
    fetchedCards: semaphorCards.length,
    deliveredStories: stories.length,
    fallbackRawOption: fallbackRaw,
    previewOption: preview,
  })

  if (stories.length > 0) {
    return buildHomePayload({
      stories,
      source: 'raw-fallback',
      generatedAt,
      notice: `Showing Semafor Security coverage (${stories.length} stories).`,
      userId: options.userId,
    })
  }

  const publishedCards = await fetchSanityDigestCards({preview})

  if (publishedCards.length > 0) {
    const stream = await buildHomeStreamWithSupplementalStories({
      cards: publishedCards,
      limit,
      source: 'sanity',
      preview,
    })

    if (stream.stories.length > 0) {
      const filteredStories = await filterHomeCardImages(stream.stories)

      return buildHomePayload({
        stories: filteredStories,
        source: 'sanity',
        generatedAt,
        notice: 'Semafor Security stream is unavailable. Falling back to published editorial digests.',
        userId: options.userId,
      })
    }
  }

  if (!fallbackRaw) {
    return buildHomePayload({
      stories: [],
      source: 'raw-fallback',
      generatedAt,
      notice: 'No Semafor Security stories are available right now.',
      userId: options.userId,
    })
  }

  const fallbackCards = await fetchRawFallbackCards(limit * 3)
  const fallbackStream = await buildHomeStreamWithSupplementalStories({
    cards: fallbackCards,
    limit,
    source: 'raw-fallback',
    preview,
  })
  const filteredFallbackStories = await filterHomeCardImages(fallbackStream.stories)

  return buildHomePayload({
    stories: filteredFallbackStories,
    source: 'raw-fallback',
    generatedAt,
    notice:
      filteredFallbackStories.length > 0
        ? 'Semafor Security stream is unavailable. Showing fallback coverage while the stream recovers.'
        : 'No Semafor Security stories are available right now.',
    userId: options.userId,
  })
}

function buildEvidenceFromRows(input: {rows: IngestedArticleRow[]; orderByArticleId?: string[]}) {
  const byId = new Map(input.rows.map((row) => [row.id, row]))
  const ordered = input.orderByArticleId
    ? input.orderByArticleId.map((id) => byId.get(id)).filter((row): row is IngestedArticleRow => Boolean(row))
    : input.rows

  return ordered.map<EvidenceBlock>((row) => ({
    id: `evidence-${row.id}`,
    articleId: row.id,
    sourceName: row.source_name,
    headline: sanitizeHeadlineText(row.title),
    excerpt: shortText(row.summary ?? row.full_text_excerpt ?? 'Coverage update available in source reporting.', 280),
    publishedAt: row.published_at ?? row.fetched_at,
    articleUrl: row.article_url,
    sourceBadge: row.source_badge,
  }))
}

function buildStoryFeedBlocks(input: {
  headline: string
  dek: string
  whyItMatters: string
  rows: IngestedArticleRow[]
}) {
  const seenBodies = new Set<string>()
  const blocks: StoryFeedBlock[] = []
  let blockIndex = 0

  function resolvePreferredFeedText(row: IngestedArticleRow) {
    const summaryText = compact(row.summary ?? row.full_text_excerpt)
    const fullText = compact(row.full_text)

    if (summaryText && countWords(summaryText) >= 65) {
      return summaryText
    }

    if (fullText) {
      return fullText
    }

    return summaryText
  }

  function pushChunkedBlockSet(inputBlock: {
    text: string
    imageUrl?: string | null
    imageAlt?: string | null
    minWords?: number
    maxWords?: number
  }) {
    const text = compact(inputBlock.text)

    if (!text) {
      return
    }

    const bodies = chunkNarrativeText(text, {
      minWords: inputBlock.minWords ?? STORY_FEED_MIN_WORDS,
      maxWords: inputBlock.maxWords ?? STORY_FEED_MAX_WORDS,
    })

    const safeBodies = bodies.length > 0 ? bodies : [text]

    safeBodies.forEach((body, index) => {
      const wordCount = countWords(body)

      if (wordCount < 35 && (blocks.length > 0 || safeBodies.length > 1)) {
        return
      }

      const bodyKey = body.toLowerCase().slice(0, 500)

      if (seenBodies.has(bodyKey)) {
        return
      }

      seenBodies.add(bodyKey)
      blockIndex += 1

      blocks.push({
        id: `feed-${blockIndex}`,
        body,
        wordCount,
        imageUrl: index === 0 && wordCount >= 45 ? inputBlock.imageUrl ?? null : null,
        imageAlt: index === 0 && wordCount >= 45 ? inputBlock.imageAlt ?? null : null,
      })
    })
  }

  for (const row of input.rows) {
    const candidateText = resolvePreferredFeedText(row)

    if (!candidateText) {
      continue
    }

    pushChunkedBlockSet({
      text: candidateText,
      imageUrl: resolveArticleRowImageUrl(row),
      imageAlt: sanitizeHeadlineText(row.title),
      minWords: 110,
      maxWords: STORY_FEED_MAX_WORDS,
    })

    const fullText = compact(row.full_text)

    if (fullText && fullText !== candidateText && countWords(fullText) > countWords(candidateText) + 120) {
      pushChunkedBlockSet({
        text: fullText,
        imageUrl: null,
        imageAlt: null,
        minWords: STORY_FEED_MIN_WORDS,
        maxWords: STORY_FEED_MAX_WORDS,
      })
    }
  }

  const normalizedBlocks = finalizeFeedBlocks(blocks)

  if (normalizedBlocks.length > 0) {
    return normalizedBlocks
  }

  const fallback = compact(`${input.dek} ${input.whyItMatters} ${input.headline}`)

  if (!fallback) {
    return [] as StoryFeedBlock[]
  }

  return [
    {
      id: 'feed-1',
      body: fallback,
      wordCount: countWords(fallback),
      imageUrl: null,
      imageAlt: null,
    },
  ]
}

function finalizeFeedBlocks(blocks: StoryFeedBlock[]) {
  if (blocks.length === 0) {
    return [] as StoryFeedBlock[]
  }

  const trimmed = [...blocks]

  while (trimmed.length > 1 && trimmed[0] && trimmed[0].wordCount < 65) {
    trimmed.shift()
  }

  const filtered =
    trimmed.length > 1 ? trimmed.filter((block, index) => block.wordCount >= 45 || index === 0) : trimmed

  return filtered.map((block, index) => ({
    ...block,
    id: `feed-${index + 1}`,
  }))
}

function normalizeImageUrlKey(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    const parsed = new URL(value)
    parsed.search = ''
    return parsed.toString()
  } catch {
    return value.trim()
  }
}

function dedupeFeedBlockImages(feedBlocks: StoryFeedBlock[], heroImageUrl: string | null) {
  const seen = new Set<string>()
  const heroKey = normalizeImageUrlKey(heroImageUrl)

  if (heroKey) {
    seen.add(heroKey)
  }

  let keptImages = 0

  return feedBlocks.map((block) => {
    const imageKey = normalizeImageUrlKey(block.imageUrl)

    if (!block.imageUrl || !imageKey) {
      return block
    }

    if (seen.has(imageKey) || keptImages >= 2) {
      return {
        ...block,
        imageUrl: null,
        imageAlt: null,
      }
    }

    seen.add(imageKey)
    keptImages += 1

    return block
  })
}

function pickHeroImageUrl(rows: IngestedArticleRow[]) {
  for (const row of rows) {
    const imageUrl = resolveArticleRowImageUrl(row)

    if (imageUrl) {
      return imageUrl
    }
  }

  return null
}

export function paginateEvidenceBlocks(evidence: EvidenceBlock[], offset = 0, limit = 8) {
  const safeOffset = Math.max(0, offset)
  const safeLimit = normalizeEvidenceBatchSize(limit)
  const slice = evidence.slice(safeOffset, safeOffset + safeLimit)

  return {
    slice,
    total: evidence.length,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + safeLimit < evidence.length,
  }
}

function paginateFeedBlocks(feedBlocks: StoryFeedBlock[], offset = 0, limit = 8) {
  const safeOffset = Math.max(0, offset)
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 24))
  const slice = feedBlocks.slice(safeOffset, safeOffset + safeLimit)

  return {
    slice,
    total: feedBlocks.length,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + safeLimit < feedBlocks.length,
  }
}

async function fetchArticlesByIds(articleIds: string[]) {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase || articleIds.length === 0) {
    return [] as IngestedArticleRow[]
  }

  const {data} = await supabase
    .from('ingested_articles')
    .select(
      'id, title, summary, full_text, full_text_excerpt, lead_image_url, canonical_image_url, source_name, source_id, source_category, source_badge, article_url, published_at, fetched_at'
    )
    .in('id', articleIds)
    .returns<IngestedArticleRow[]>()

  return data ?? []
}

async function fetchSanitySemaphorNewsItem(clusterKey: string, preview: boolean): Promise<SemaphorNewsItemDoc | null> {
  const sanity = createOptionalSanityServerClient()

  if (!sanity) {
    return null
  }

  const params = {
    sourceId: SEMAPHOR_SOURCE_ID,
    clusterKey,
  }

  if (preview) {
    const draftDoc = await sanity.fetch<SemaphorNewsItemDoc | null>(
      `*[
        _type == "newsItem"
        && sourceId == $sourceId
        && contentFetchStatus == "fetched"
        && (clusterKey == $clusterKey || articleId == $clusterKey)
        && _id in path("drafts.**")
      ] | order(coalesce(publishedAt, fetchedAt, syncedAt) desc)[0]${SANITY_SEMAPHOR_NEWS_ITEM_PROJECTION}`,
      params
    )

    if (draftDoc) {
      return draftDoc
    }
  }

  return sanity.fetch<SemaphorNewsItemDoc | null>(
    `*[
      _type == "newsItem"
      && sourceId == $sourceId
      && contentFetchStatus == "fetched"
      && (clusterKey == $clusterKey || articleId == $clusterKey)
      && !(_id in path("drafts.**"))
    ] | order(coalesce(publishedAt, fetchedAt, syncedAt) desc)[0]${SANITY_SEMAPHOR_NEWS_ITEM_PROJECTION}`,
    params
  )
}

function toIngestedRowFromSemaphorNewsItem(newsItem: SemaphorNewsItemDoc): IngestedArticleRow | null {
  const id = compact(newsItem.articleId)
  const title = sanitizeHeadlineText(compact(newsItem.title))
  const articleUrl = compact(newsItem.articleUrl)
  const sourceName = compact(newsItem.sourceName) || 'Semafor Security'
  const sourceId = compact(newsItem.sourceId) || SEMAPHOR_SOURCE_ID
  const fetchedAt = newsItem.fetchedAt ?? newsItem.syncedAt ?? new Date().toISOString()

  if (!id || !title || !articleUrl || !fetchedAt) {
    return null
  }

  return {
    id,
    title,
    summary: compact(newsItem.summary) || null,
    full_text: compact(newsItem.fullText) || null,
    full_text_excerpt: compact(newsItem.fullTextExcerpt) || null,
    lead_image_url: newsItem.leadImageUrl,
    canonical_image_url: newsItem.canonicalImageUrl,
    source_name: sourceName,
    source_id: sourceId,
    source_category: compact(newsItem.sourceCategory) || 'journalism',
    source_badge: compact(newsItem.sourceBadge) || 'Reporting',
    article_url: articleUrl,
    published_at: newsItem.publishedAt,
    fetched_at: fetchedAt,
  }
}

function toIngestedRowFromSemaphorSecurityStory(
  story: Awaited<ReturnType<typeof fetchSemaphorSecurityStories>>[number]
): IngestedArticleRow | null {
  const id = compact(story.id)
  const title = sanitizeHeadlineText(compact(story.headline))
  const articleUrl = compact(story.articleUrl)
  const fetchedAt = new Date().toISOString()

  if (!id || !title || !articleUrl) {
    return null
  }

  const subtitle = compact(story.subtitle)

  return {
    id,
    title,
    summary: subtitle || null,
    full_text: null,
    full_text_excerpt: subtitle || null,
    lead_image_url: story.imageUrl,
    canonical_image_url: story.imageUrl,
    source_name: 'Semafor Security',
    source_id: SEMAPHOR_SOURCE_ID,
    source_category: 'journalism',
    source_badge: 'Reporting',
    article_url: articleUrl,
    published_at: story.publishedAt,
    fetched_at: fetchedAt,
  }
}

async function buildSemaphorStoryDetailFromRow(input: {
  clusterKey: string
  row: IngestedArticleRow
  topicLabel: string
  source: CuratedStoryDetail['source']
  offset: number
  evidenceLimit: number
  feedLimit: number
  userId?: string | null
}): Promise<CuratedStoryDetail> {
  const evidence = buildEvidenceFromRows({rows: [input.row]})
  const paged = paginateEvidenceBlocks(evidence, input.offset, input.evidenceLimit)
  const storyTopics = await buildStoryTopicsForDetail({
    articleIds: [input.row.id],
    userId: input.userId,
  })
  const heroImageUrl = resolveArticleRowImageUrl(input.row)
  const narrativeFallback = deriveNarrativeFromRows([input.row], 260)
  const resolvedDek = selectNarrativeText({
    primary: input.row.summary ?? input.row.full_text_excerpt,
    fallback: narrativeFallback,
    max: 260,
    minCharacters: 70,
  })
  const resolvedWhyItMatters = selectNarrativeText({
    primary: firstSentence(input.row.summary ?? input.row.full_text_excerpt ?? input.row.full_text ?? '', 320),
    fallback: firstSentence(narrativeFallback, 320),
    max: 320,
    minCharacters: 45,
  })
  const feedBlocks = dedupeFeedBlockImages(
    buildStoryFeedBlocks({
      headline: sanitizeHeadlineText(input.row.title),
      dek: resolvedDek,
      whyItMatters: resolvedWhyItMatters,
      rows: [input.row],
    }),
    heroImageUrl
  )
  const filteredStoryImages = await filterStoryDetailImages({
    headline: sanitizeHeadlineText(input.row.title),
    dek: resolvedDek,
    whyItMatters: resolvedWhyItMatters,
    riskLevel: deriveRiskFromText(`${input.row.title} ${input.row.summary ?? input.row.full_text_excerpt ?? ''}`),
    heroImageUrl,
    feedBlocks,
  })
  const pagedFeed = paginateFeedBlocks(filteredStoryImages.feedBlocks, input.offset, input.feedLimit)
  const sourceLinks: CuratedSourceLink[] = [
    {
      articleId: input.row.id,
      sourceName: input.row.source_name,
      url: input.row.article_url,
      headline: sanitizeHeadlineText(input.row.title),
      sourceRole: 'reporting',
    },
  ]
  const curation = summarizeCurationFromLinks({
    links: sourceLinks,
    pressReleaseDriven: false,
    opinionLimited: false,
  })

  return {
    clusterKey: input.clusterKey,
    topicLabel: normalizeTopicLabel(input.topicLabel),
    attributionLine: buildStoryAttributionLine({
      sourceLinks,
      citationCount: 1,
      publishedAt: input.row.published_at ?? input.row.fetched_at,
    }),
    headline: sanitizeHeadlineText(input.row.title),
    dek: resolvedDek,
    whyItMatters: resolvedWhyItMatters,
    riskLevel: deriveRiskFromText(`${input.row.title} ${input.row.summary ?? input.row.full_text_excerpt ?? ''}`),
    citationCount: 1,
    generationMode: 'deterministic',
    reviewStatus: 'published',
    isCongestedCluster: false,
    publishedAt: input.row.published_at ?? input.row.fetched_at,
    heroImageUrl: filteredStoryImages.heroImageUrl,
    sourceLinks,
    topics: storyTopics,
    ...curation,
    feedBlocks: pagedFeed.slice,
    totalFeedBlocks: pagedFeed.total,
    evidence: paged.slice,
    totalEvidence: paged.total,
    offset: pagedFeed.offset,
    limit: pagedFeed.limit,
    hasMore: pagedFeed.hasMore,
    source: input.source,
  }
}

async function buildSemaphorStoryDetailFromSanity(input: {
  clusterKey: string
  newsItem: SemaphorNewsItemDoc
  offset: number
  evidenceLimit: number
  feedLimit: number
  userId?: string | null
}): Promise<CuratedStoryDetail | null> {
  const row = toIngestedRowFromSemaphorNewsItem(input.newsItem)

  if (!row) {
    return null
  }

  const topicLabel = normalizeTopicLabel(
    input.newsItem.topics?.find((topic) => topic.isPrimary)?.label ?? input.newsItem.topics?.[0]?.label ?? 'Security'
  )

  return buildSemaphorStoryDetailFromRow({
    clusterKey: compact(input.newsItem.clusterKey ?? input.clusterKey) || input.clusterKey,
    row,
    topicLabel,
    source: 'sanity',
    offset: input.offset,
    evidenceLimit: input.evidenceLimit,
    feedLimit: input.feedLimit,
    userId: input.userId,
  })
}

async function buildSemaphorStoryDetailFromSecurityFeed(input: {
  clusterKey: string
  offset: number
  evidenceLimit: number
  feedLimit: number
  userId?: string | null
}): Promise<CuratedStoryDetail | null> {
  try {
    const stories = await fetchSemaphorSecurityStories(200)
    const matched = stories.find((story) => compact(story.id) === input.clusterKey)

    if (!matched) {
      return null
    }

    const row = toIngestedRowFromSemaphorSecurityStory(matched)

    if (!row) {
      return null
    }

    return buildSemaphorStoryDetailFromRow({
      clusterKey: input.clusterKey,
      row,
      topicLabel: 'Security',
      source: 'raw-fallback',
      offset: input.offset,
      evidenceLimit: input.evidenceLimit,
      feedLimit: input.feedLimit,
      userId: input.userId,
    })
  } catch (error) {
    logEditorialUiEvent('warn', 'story_detail_semaphor_feed_fetch_failed', {
      clusterKey: input.clusterKey,
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    return null
  }
}

export async function getCuratedStoryDetail(
  clusterKey: string,
  options: StoryDetailOptions = {}
): Promise<CuratedStoryDetail | null> {
  const safeClusterKey = clusterKey.trim()

  if (!safeClusterKey) {
    return null
  }

  const offset = Math.max(0, options.offset ?? 0)
  const requestedLimit =
    typeof options.limit === 'number' && Number.isFinite(options.limit) ? Math.trunc(options.limit) : DEFAULT_EVIDENCE_BATCH
  const evidenceLimit = normalizeEvidenceBatchSize(requestedLimit)
  const feedLimit = Math.max(1, Math.min(requestedLimit, 24))
  const preview = resolvePreviewMode(options.preview)

  const sanity = createOptionalSanityServerClient()

  if (sanity) {
    try {
      const digest = preview
        ? await (async () => {
            const draftDigest = await sanity.fetch<StoryDigestDoc | null>(
              `*[_type == "storyDigest" && clusterKey == $clusterKey && _id in path("drafts.**")]
                | order(generatedAt desc)[0]${SANITY_DIGEST_PROJECTION}`,
              {
                clusterKey: safeClusterKey,
              }
            )

            if (draftDigest) {
              return draftDigest
            }

            return sanity.fetch<StoryDigestDoc | null>(
              `*[_type == "storyDigest" && clusterKey == $clusterKey && !(_id in path("drafts.**"))][0]${SANITY_DIGEST_PROJECTION}`,
              {
                clusterKey: safeClusterKey,
              }
            )
          })()
        : await sanity.fetch<StoryDigestDoc | null>(
            `*[_type == "storyDigest" && clusterKey == $clusterKey && !(_id in path("drafts.**"))][0]${SANITY_DIGEST_PROJECTION}`,
            {
              clusterKey: safeClusterKey,
            }
          )

      if (digest) {
        const sourceLinks = dedupeSourceLinks(
          (digest.citations ?? []).map((citation) => ({
            articleId: citation.articleId,
            sourceName: citation.sourceName,
            url: citation.url,
            headline: sanitizeHeadlineText(citation.headline),
            sourceRole: asSourceRole(citation.sourceRole),
          })),
          20
        )
        const inferredCuration = summarizeCurationFromLinks({
          links: sourceLinks,
          pressReleaseDriven: digest.pressReleaseDriven ?? false,
          opinionLimited: digest.opinionLimited ?? false,
        })
        const hasOfficialSource = digest.hasOfficialSource ?? inferredCuration.hasOfficialSource
        const reportingCount = Math.max(0, Number(digest.reportingCount ?? inferredCuration.reportingCount))
        const analysisCount = Math.max(0, Number(digest.analysisCount ?? inferredCuration.analysisCount))
        const officialCount = Math.max(0, Number(digest.officialCount ?? inferredCuration.officialCount))
        const opinionCount = Math.max(0, Number(digest.opinionCount ?? inferredCuration.opinionCount))
        const pressReleaseDriven = Boolean(digest.pressReleaseDriven ?? inferredCuration.pressReleaseDriven)
        const opinionLimited = Boolean(digest.opinionLimited ?? inferredCuration.opinionLimited)
        const sourceDiversity = Math.max(1, Number(digest.sourceDiversity ?? inferredCuration.sourceDiversity))

        const orderedArticleIds = sourceLinks.map((citation) => citation.articleId)
        const evidenceRows = await fetchArticlesByIds(orderedArticleIds)
        const evidence = buildEvidenceFromRows({
          rows: evidenceRows,
          orderByArticleId: orderedArticleIds,
        })

        const paged = paginateEvidenceBlocks(evidence, offset, evidenceLimit)
        const heroImageUrl = pickHeroImageUrl(evidenceRows)
        const narrativeFallback = deriveNarrativeFromRows(evidenceRows, 260)
        const resolvedDek = selectNarrativeText({
          primary: digest.dek,
          fallback: narrativeFallback,
          max: 260,
          minCharacters: 70,
        })
        const resolvedWhyItMatters = selectNarrativeText({
          primary: digest.whyItMatters,
          fallback: firstSentence(narrativeFallback, 320),
          max: 320,
          minCharacters: 45,
        })
        const feedBlocks = dedupeFeedBlockImages(
          buildStoryFeedBlocks({
            headline: sanitizeHeadlineText(digest.headline),
            dek: resolvedDek,
            whyItMatters: resolvedWhyItMatters,
            rows: evidenceRows,
          }),
          heroImageUrl
        )
        const filteredStoryImages = await filterStoryDetailImages({
          headline: sanitizeHeadlineText(digest.headline),
          dek: resolvedDek,
          whyItMatters: resolvedWhyItMatters,
          riskLevel: asRiskLevel(digest.riskLevel),
          heroImageUrl,
          feedBlocks,
        })
        const pagedFeed = paginateFeedBlocks(filteredStoryImages.feedBlocks, offset, feedLimit)
        const storyTopics = await buildStoryTopicsForDetail({
          articleIds: orderedArticleIds,
          userId: options.userId,
        })

        return {
          clusterKey: digest.clusterKey,
          topicLabel: normalizeTopicLabel(digest.topicLabel),
          attributionLine: buildStoryAttributionLine({
            sourceLinks,
            citationCount: Math.max(0, Number(digest.citationCount ?? sourceLinks.length)),
            publishedAt: digest.generatedAt ?? new Date().toISOString(),
          }),
          headline: sanitizeHeadlineText(digest.headline),
          dek: resolvedDek,
          whyItMatters: resolvedWhyItMatters,
          riskLevel: asRiskLevel(digest.riskLevel),
          citationCount: Math.max(0, Number(digest.citationCount ?? sourceLinks.length)),
          generationMode: digest.generationMode === 'transform' ? 'transform' : 'deterministic',
          reviewStatus: asReviewStatus(digest.reviewStatus),
          isCongestedCluster: Boolean(digest.isCongestedCluster),
          publishedAt: digest.generatedAt ?? new Date().toISOString(),
          heroImageUrl: filteredStoryImages.heroImageUrl,
          sourceLinks,
          topics: storyTopics,
          hasOfficialSource,
          reportingCount,
          analysisCount,
          officialCount,
          opinionCount,
          pressReleaseDriven,
          opinionLimited,
          sourceDiversity,
          feedBlocks: pagedFeed.slice,
          totalFeedBlocks: pagedFeed.total,
          evidence: paged.slice,
          totalEvidence: paged.total,
          offset: pagedFeed.offset,
          limit: pagedFeed.limit,
          hasMore: pagedFeed.hasMore,
          source: 'sanity',
        }
      }

      const semaphorNewsItem = await fetchSanitySemaphorNewsItem(safeClusterKey, preview)

      if (semaphorNewsItem) {
        const semaphorDetail = await buildSemaphorStoryDetailFromSanity({
          clusterKey: safeClusterKey,
          newsItem: semaphorNewsItem,
          offset,
          evidenceLimit,
          feedLimit,
          userId: options.userId,
        })

        if (semaphorDetail) {
          return semaphorDetail
        }
      }
    } catch (error) {
      logEditorialUiEvent('warn', 'story_detail_sanity_fetch_failed', {
        clusterKey: safeClusterKey,
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    const semaphorFallback = await buildSemaphorStoryDetailFromSecurityFeed({
      clusterKey: safeClusterKey,
      offset,
      evidenceLimit,
      feedLimit,
      userId: options.userId,
    })

    if (semaphorFallback) {
      return semaphorFallback
    }

    logEditorialUiEvent('warn', 'story_detail_miss', {
      clusterKey: safeClusterKey,
      reason: 'supabase_not_configured',
    })
    return null
  }

  const rawClusterArticleId = safeClusterKey.startsWith('raw-') ? safeClusterKey.slice(4) : null

  if (rawClusterArticleId) {
    const rows = await fetchArticlesByIds([rawClusterArticleId])
    const row = rows[0]

    if (!row) {
      logEditorialUiEvent('warn', 'story_detail_miss', {
        clusterKey: safeClusterKey,
        reason: 'raw_article_not_found',
      })
      return null
    }

    const evidence = buildEvidenceFromRows({rows: [row]})
    const paged = paginateEvidenceBlocks(evidence, offset, evidenceLimit)
    const heroImageUrl = resolveArticleRowImageUrl(row)
    const narrativeFallback = deriveNarrativeFromRows([row], 260)
    const resolvedDek = selectNarrativeText({
      primary: row.summary ?? row.full_text_excerpt,
      fallback: narrativeFallback,
      max: 260,
      minCharacters: 70,
    })
    const resolvedWhyItMatters = selectNarrativeText({
      primary: firstSentence(row.summary ?? row.full_text_excerpt ?? '', 320),
      fallback: firstSentence(narrativeFallback, 320),
      max: 320,
      minCharacters: 45,
    })
    const feedBlocks = dedupeFeedBlockImages(
      buildStoryFeedBlocks({
        headline: sanitizeHeadlineText(row.title),
        dek: resolvedDek,
        whyItMatters: resolvedWhyItMatters,
        rows: [row],
      }),
      heroImageUrl
    )
    const filteredStoryImages = await filterStoryDetailImages({
      headline: sanitizeHeadlineText(row.title),
      dek: resolvedDek,
      whyItMatters: resolvedWhyItMatters,
      riskLevel: deriveRiskFromText(`${row.title} ${row.summary ?? ''}`),
      heroImageUrl,
      feedBlocks,
    })
    const pagedFeed = paginateFeedBlocks(filteredStoryImages.feedBlocks, offset, feedLimit)
    const sourceRole = resolveEditorialSourceRole({
      sourceId: row.source_id,
      sourceName: row.source_name,
      sourceCategory: row.source_category,
      sourceBadge: row.source_badge,
      title: row.title,
    })
    const sourceLinks: CuratedSourceLink[] = [
      {
        articleId: row.id,
        sourceName: row.source_name,
        url: row.article_url,
        headline: sanitizeHeadlineText(row.title),
        sourceRole,
      },
    ]
    const curation = summarizeCurationFromLinks({
      links: sourceLinks,
      pressReleaseDriven: sourceRole === 'official',
      opinionLimited: false,
    })
    const storyTopics = await buildStoryTopicsForDetail({
      articleIds: [row.id],
      userId: options.userId,
    })

    logEditorialUiEvent('info', 'story_detail_raw_fallback', {
      clusterKey: safeClusterKey,
      mode: 'single-article',
    })

    return {
      clusterKey: safeClusterKey,
      topicLabel: 'General defense',
      attributionLine: buildStoryAttributionLine({
        sourceLinks,
        citationCount: 1,
        publishedAt: row.published_at ?? row.fetched_at,
      }),
      headline: sanitizeHeadlineText(row.title),
      dek: resolvedDek,
      whyItMatters: resolvedWhyItMatters,
      riskLevel: deriveRiskFromText(`${row.title} ${row.summary ?? ''}`),
      citationCount: 1,
      generationMode: 'deterministic',
      reviewStatus: 'published',
      isCongestedCluster: false,
      publishedAt: row.published_at ?? row.fetched_at,
      heroImageUrl: filteredStoryImages.heroImageUrl,
      sourceLinks,
      topics: storyTopics,
      hasOfficialSource: curation.hasOfficialSource,
      reportingCount: curation.reportingCount,
      analysisCount: curation.analysisCount,
      officialCount: curation.officialCount,
      opinionCount: curation.opinionCount,
      pressReleaseDriven: curation.pressReleaseDriven,
      opinionLimited: curation.opinionLimited,
      sourceDiversity: curation.sourceDiversity,
      feedBlocks: pagedFeed.slice,
      totalFeedBlocks: pagedFeed.total,
      evidence: paged.slice,
      totalEvidence: paged.total,
      offset: pagedFeed.offset,
      limit: pagedFeed.limit,
      hasMore: pagedFeed.hasMore,
      source: 'raw-fallback',
    }
  }

  const {data: clusterRow} = await supabase
    .from('story_clusters')
    .select(
      'id, cluster_key, headline, topic_label, congestion_score, is_congested, generation_mode, review_status, last_generated_at'
    )
    .eq('cluster_key', safeClusterKey)
    .maybeSingle<StoryClusterRow>()

  if (!clusterRow) {
    const semaphorFallback = await buildSemaphorStoryDetailFromSecurityFeed({
      clusterKey: safeClusterKey,
      offset,
      evidenceLimit,
      feedLimit,
      userId: options.userId,
    })

    if (semaphorFallback) {
      return semaphorFallback
    }

    logEditorialUiEvent('warn', 'story_detail_miss', {
      clusterKey: safeClusterKey,
      reason: 'cluster_not_found',
    })
    return null
  }

  const {data: memberRows} = await supabase
    .from('cluster_members')
    .select('article_id, is_representative, similarity')
    .eq('cluster_id', clusterRow.id)
    .returns<ClusterMemberRow[]>()

  const members = memberRows ?? []

  if (members.length === 0) {
    logEditorialUiEvent('warn', 'story_detail_miss', {
      clusterKey: safeClusterKey,
      reason: 'cluster_has_no_members',
    })
    return null
  }

  const articleIdsOrdered = [...members]
    .sort((left, right) => Number(right.is_representative) - Number(left.is_representative) || Number((right.similarity ?? 0) - (left.similarity ?? 0)))
    .map((member) => member.article_id)

  const rows = await fetchArticlesByIds(articleIdsOrdered)
  const evidence = buildEvidenceFromRows({rows, orderByArticleId: articleIdsOrdered})

  if (evidence.length === 0) {
    logEditorialUiEvent('warn', 'story_detail_miss', {
      clusterKey: safeClusterKey,
      reason: 'cluster_members_missing_in_ingested_articles',
    })
    return null
  }

  const representative = evidence[0]
  const paged = paginateEvidenceBlocks(evidence, offset, evidenceLimit)
  const sourceLinks = dedupeSourceLinks(
    evidence.map((block) => ({
      articleId: block.articleId,
      sourceName: block.sourceName,
      url: block.articleUrl,
      headline: block.headline,
      sourceRole: resolveEditorialSourceRole({
        sourceName: block.sourceName,
        sourceBadge: block.sourceBadge,
        title: block.headline,
      }),
    })),
    20
  )
  const curation = summarizeCurationFromLinks({
    links: sourceLinks,
    pressReleaseDriven: false,
    opinionLimited: false,
  })
  const heroImageUrl = pickHeroImageUrl(rows)
  const narrativeFallback = deriveNarrativeFromRows(rows, 260)
  const resolvedDek = selectNarrativeText({
    primary: representative.excerpt,
    fallback: narrativeFallback,
    max: 260,
    minCharacters: 70,
  })
  const resolvedWhyItMatters = selectNarrativeText({
    primary: firstSentence(representative.excerpt, 320),
    fallback: `${evidence.length} corroborating reports were grouped for cross-source verification.`,
    max: 320,
    minCharacters: 45,
  })
  const feedBlocks = dedupeFeedBlockImages(
    buildStoryFeedBlocks({
      headline: sanitizeHeadlineText(clusterRow.headline),
      dek: resolvedDek,
      whyItMatters: resolvedWhyItMatters,
      rows,
    }),
    heroImageUrl
  )
  const filteredStoryImages = await filterStoryDetailImages({
    headline: sanitizeHeadlineText(clusterRow.headline),
    dek: resolvedDek,
    whyItMatters: resolvedWhyItMatters,
    riskLevel: (clusterRow.congestion_score ?? 0) >= 0.85 ? 'high' : (clusterRow.congestion_score ?? 0) >= 0.6 ? 'medium' : 'low',
    heroImageUrl,
    feedBlocks,
  })
  const pagedFeed = paginateFeedBlocks(filteredStoryImages.feedBlocks, offset, feedLimit)
  const storyTopics = await buildStoryTopicsForDetail({
    articleIds: rows.map((row) => row.id),
    userId: options.userId,
  })

  logEditorialUiEvent('info', 'story_detail_raw_fallback', {
    clusterKey: safeClusterKey,
    mode: 'cluster',
    evidenceCount: evidence.length,
  })

  return {
    clusterKey: clusterRow.cluster_key,
    topicLabel: normalizeTopicLabel(clusterRow.topic_label),
    attributionLine: buildStoryAttributionLine({
      sourceLinks,
      citationCount: evidence.length,
      publishedAt: clusterRow.last_generated_at ?? new Date().toISOString(),
    }),
    headline: sanitizeHeadlineText(clusterRow.headline),
    dek: resolvedDek,
    whyItMatters: resolvedWhyItMatters,
    riskLevel: (clusterRow.congestion_score ?? 0) >= 0.85 ? 'high' : (clusterRow.congestion_score ?? 0) >= 0.6 ? 'medium' : 'low',
    citationCount: evidence.length,
    generationMode: clusterRow.generation_mode === 'transform' ? 'transform' : 'deterministic',
    reviewStatus: asReviewStatus(clusterRow.review_status),
    isCongestedCluster: Boolean(clusterRow.is_congested),
    publishedAt: clusterRow.last_generated_at ?? new Date().toISOString(),
    heroImageUrl: filteredStoryImages.heroImageUrl,
    sourceLinks,
    topics: storyTopics,
    ...curation,
    feedBlocks: pagedFeed.slice,
    totalFeedBlocks: pagedFeed.total,
    evidence: paged.slice,
    totalEvidence: paged.total,
    offset: pagedFeed.offset,
    limit: pagedFeed.limit,
    hasMore: pagedFeed.hasMore,
    source: 'raw-fallback',
  }
}
