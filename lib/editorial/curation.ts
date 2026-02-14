import {
  getDefenseFeedSourceById,
  resolveSourceStoryRole,
  sourceQualityWeight,
  type DefenseSourceStoryRole,
} from '@/lib/ingest/sources'

import type {ClusterMember, EditorialArticle, StoryCluster, StoryDigestCitation} from './types'

export type EditorialSourceRole = DefenseSourceStoryRole

export type StoryCurationSummary = {
  reportingCount: number
  analysisCount: number
  officialCount: number
  opinionCount: number
  hasOfficialSource: boolean
  pressReleaseDriven: boolean
  opinionLimited: boolean
  sourceDiversity: number
}

export const HOMEPAGE_MAX_STORIES_PER_SOURCE = 3

function normalize(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function editorialSourceRolePriority(role: EditorialSourceRole) {
  switch (role) {
    case 'reporting':
      return 4
    case 'official':
      return 3
    case 'analysis':
      return 2
    case 'opinion':
      return 1
    default:
      return 0
  }
}

const opinionIndicators = [
  'op-ed',
  'op ed',
  'opinion',
  'commentary',
  'editorial',
  'guest essay',
  'viewpoint',
  'column',
]

const pressReleaseIndicators = [
  'press release',
  'statement',
  'awards',
  'award',
  'contract',
  'rfp',
  'solicitation',
  'budget request',
  'appropriation',
  'official says',
  'official statement',
]

function hasIndicator(text: string, indicators: readonly string[]) {
  return indicators.some((indicator) => text.includes(indicator))
}

function isOpinionLikeTitle(value: string | null | undefined) {
  return hasIndicator(normalize(value), opinionIndicators)
}

function isPressReleaseLikeText(value: string | null | undefined) {
  return hasIndicator(normalize(value), pressReleaseIndicators)
}

type SourceRoleInput = {
  sourceId?: string | null
  sourceName?: string | null
  sourceBadge?: string | null
  sourceCategory?: string | null
  title?: string | null
}

export function resolveEditorialSourceRole(input: SourceRoleInput): EditorialSourceRole {
  const role = resolveSourceStoryRole({
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    sourceBadge: input.sourceBadge,
    sourceCategory: input.sourceCategory,
  })

  if (role === 'reporting' && isOpinionLikeTitle(input.title)) {
    return 'opinion'
  }

  return role
}

type CitationCandidate = {
  article: EditorialArticle
  role: EditorialSourceRole
  sourceKey: string
  qualityWeight: number
  publishedAt: number
  isRepresentative: boolean
}

function compareCandidates(left: CitationCandidate, right: CitationCandidate) {
  const roleDiff = editorialSourceRolePriority(right.role) - editorialSourceRolePriority(left.role)

  if (roleDiff !== 0) {
    return roleDiff
  }

  const qualityDiff = right.qualityWeight - left.qualityWeight

  if (qualityDiff !== 0) {
    return qualityDiff
  }

  if (right.isRepresentative !== left.isRepresentative) {
    return Number(right.isRepresentative) - Number(left.isRepresentative)
  }

  return right.publishedAt - left.publishedAt
}

function toCandidate(member: ClusterMember): CitationCandidate {
  const article = member.article
  const role = resolveEditorialSourceRole({
    sourceId: article.sourceId,
    sourceName: article.sourceName,
    sourceBadge: article.sourceBadge,
    title: article.title,
  })
  const qualityWeight = sourceQualityWeight(getDefenseFeedSourceById(article.sourceId)?.qualityTier ?? 'medium')

  return {
    article,
    role,
    sourceKey: normalize(article.sourceName) || article.sourceId,
    qualityWeight,
    publishedAt: parseTimestamp(article.publishedAt ?? article.fetchedAt),
    isRepresentative: member.isRepresentative,
  }
}

function appendUniqueBySource(input: {
  target: CitationCandidate[]
  candidates: CitationCandidate[]
  usedSources: Set<string>
  maxAdd: number
}) {
  for (const candidate of input.candidates) {
    if (input.maxAdd <= 0) {
      return
    }

    if (input.usedSources.has(candidate.sourceKey)) {
      continue
    }

    input.target.push(candidate)
    input.usedSources.add(candidate.sourceKey)
    input.maxAdd -= 1
  }
}

function summarizeRoles(input: {
  roles: EditorialSourceRole[]
  pressReleaseDriven: boolean
  opinionLimited: boolean
  sourceDiversity: number
}): StoryCurationSummary {
  const reportingCount = input.roles.filter((role) => role === 'reporting').length
  const analysisCount = input.roles.filter((role) => role === 'analysis').length
  const officialCount = input.roles.filter((role) => role === 'official').length
  const opinionCount = input.roles.filter((role) => role === 'opinion').length

  return {
    reportingCount,
    analysisCount,
    officialCount,
    opinionCount,
    hasOfficialSource: officialCount > 0,
    pressReleaseDriven: input.pressReleaseDriven,
    opinionLimited: input.opinionLimited,
    sourceDiversity: input.sourceDiversity,
  }
}

function isPressReleaseDrivenCluster(cluster: StoryCluster, candidates: CitationCandidate[]) {
  const officialCount = candidates.filter((candidate) => candidate.role === 'official').length

  if (officialCount === 0) {
    return false
  }

  const representativeText = `${cluster.representativeArticle.title} ${cluster.representativeArticle.summary ?? ''}`
  const officialShare = officialCount / Math.max(1, cluster.members.length)

  return isPressReleaseLikeText(representativeText) || officialShare >= 0.3
}

function toCitation(candidate: CitationCandidate): StoryDigestCitation {
  return {
    articleId: candidate.article.id,
    headline: candidate.article.title,
    sourceName: candidate.article.sourceName,
    url: candidate.article.articleUrl,
    sourceRole: candidate.role,
  }
}

export function buildCuratedCitations(
  cluster: StoryCluster,
  options?: {
    maxCitations?: number
  }
): {
  citations: StoryDigestCitation[]
  summary: StoryCurationSummary
} {
  const maxCitations = Math.max(3, Math.min(options?.maxCitations ?? 10, 16))
  const candidates = cluster.members.map(toCandidate).sort(compareCandidates)

  if (candidates.length === 0) {
    return {
      citations: [],
      summary: summarizeRoles({
        roles: [],
        pressReleaseDriven: false,
        opinionLimited: false,
        sourceDiversity: 0,
      }),
    }
  }

  const reporting = candidates.filter((candidate) => candidate.role === 'reporting')
  const official = candidates.filter((candidate) => candidate.role === 'official')
  const analysis = candidates.filter((candidate) => candidate.role === 'analysis')
  const opinion = candidates.filter((candidate) => candidate.role === 'opinion')
  const pressReleaseDriven = isPressReleaseDrivenCluster(cluster, candidates)

  const selected: CitationCandidate[] = []
  const usedSources = new Set<string>()

  appendUniqueBySource({
    target: selected,
    candidates: reporting,
    usedSources,
    maxAdd: 2,
  })

  if (pressReleaseDriven) {
    appendUniqueBySource({
      target: selected,
      candidates: official,
      usedSources,
      maxAdd: 1,
    })
  }

  appendUniqueBySource({
    target: selected,
    candidates: analysis,
    usedSources,
    maxAdd: 1,
  })

  const opinionBudget = opinion.length > 0 ? 1 : 0

  appendUniqueBySource({
    target: selected,
    candidates: [...reporting, ...official, ...analysis].sort(compareCandidates),
    usedSources,
    maxAdd: Math.max(0, maxCitations - selected.length - opinionBudget),
  })

  appendUniqueBySource({
    target: selected,
    candidates: opinion,
    usedSources,
    maxAdd: Math.max(0, maxCitations - selected.length),
  })

  if (selected.length === 0) {
    appendUniqueBySource({
      target: selected,
      candidates,
      usedSources,
      maxAdd: maxCitations,
    })
  }

  const citations = selected.slice(0, maxCitations).map(toCitation)
  const sourceDiversity = new Set(citations.map((citation) => normalize(citation.sourceName))).size
  const selectedOpinionCount = citations.filter((citation) => citation.sourceRole === 'opinion').length

  return {
    citations,
    summary: summarizeRoles({
      roles: citations.map((citation) => citation.sourceRole),
      pressReleaseDriven,
      opinionLimited: opinion.length > selectedOpinionCount,
      sourceDiversity,
    }),
  }
}

export function summarizeCurationFromLinks(input: {
  links: Array<{
    sourceRole?: EditorialSourceRole | null
    sourceName?: string | null
  }>
  pressReleaseDriven?: boolean
  opinionLimited?: boolean
}) {
  const roles = input.links.map((link) => link.sourceRole ?? 'reporting')
  const sourceDiversity = new Set(input.links.map((link) => normalize(link.sourceName))).size

  return summarizeRoles({
    roles,
    pressReleaseDriven: Boolean(input.pressReleaseDriven),
    opinionLimited: Boolean(input.opinionLimited),
    sourceDiversity,
  })
}

export function sourceRoleScoreAdjustment(role: EditorialSourceRole) {
  switch (role) {
    case 'reporting':
      return 3200
    case 'official':
      return 1800
    case 'analysis':
      return 600
    case 'opinion':
      return -3800
    default:
      return 0
  }
}
