import {normalizeTopicKey} from './slug'
import {
  aliasRequiresDefenseContext,
  hasDefenseContext,
  isLowValueTopicLabel,
  normalizeTopicLabelForMatching,
} from './quality'
import {curatedTopicTaxonomy, type TopicType} from './taxonomy'

export interface TopicExtractionInput {
  title: string
  summary?: string | null
  fullText?: string | null
  sourceId?: string | null
  sourceName?: string | null
  sourceCategory?: string | null
}

export interface ExtractedTopicCandidate {
  slug: string
  label: string
  topicType: TopicType
  occurrences: number
  confidence: number
  isPrimary: boolean
  matchedBy: 'taxonomy' | 'ner'
}

export type TopicExtractionProfile = 'default' | 'official_guidance'

const officialGuidanceSourceIds = new Set(['uk-mod'])
const officialGuidanceNoiseLinePatterns = [
  /^(?:added|updated|published|last updated|last modified)\b/i,
  /^\d{1,2}\s+[a-z]{3,9}\s+\d{4}$/i,
  /^(?:mon|tue|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+\d{1,2}\s+[a-z]{3,9}\s+\d{4}$/i,
  /^(?:share this page|contents|table of contents)$/i,
]

const MAX_TOPICS_PER_ARTICLE = 24

type CanonicalAliasRule = {
  normalizedAlias: string
  requiresDefenseContext: boolean
}

type CanonicalTopicRule = {
  slug: string
  label: string
  topicType: TopicType
  aliases: CanonicalAliasRule[]
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countOccurrences(corpus: string, rawValue: string) {
  const value = rawValue.trim()

  if (!value) {
    return 0
  }

  const matcher = new RegExp(`(?<![a-z0-9])${escapeRegExp(value)}(?![a-z0-9])`, 'g')
  const matches = corpus.match(matcher)
  return matches?.length ?? 0
}

export function resolveTopicExtractionProfile(input: TopicExtractionInput): TopicExtractionProfile {
  const sourceId = normalizeTopicKey(input.sourceId ?? '')

  if (sourceId && officialGuidanceSourceIds.has(sourceId)) {
    return 'official_guidance'
  }

  const sourceCategory = normalizeTopicKey(input.sourceCategory ?? '')
  const sourceName = normalizeTopicKey(input.sourceName ?? '')

  if (sourceCategory === 'official' && sourceName.includes('ministry of defence')) {
    return 'official_guidance'
  }

  return 'default'
}

function cleanOfficialGuidanceBody(value: string) {
  if (!value) {
    return ''
  }

  const lines = value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())

  const cleaned: string[] = []

  for (const line of lines) {
    if (!line) {
      continue
    }

    if (officialGuidanceNoiseLinePatterns.some((pattern) => pattern.test(line))) {
      continue
    }

    cleaned.push(line)
  }

  return cleaned.join(' ')
}

function buildCorpora(input: TopicExtractionInput) {
  const extractionProfile = resolveTopicExtractionProfile(input)
  const title = input.title.trim()
  const summary = (input.summary ?? '').trim()
  const rawFullText = (input.fullText ?? '').trim()
  const fullText = extractionProfile === 'official_guidance' ? cleanOfficialGuidanceBody(rawFullText) : rawFullText

  const source = [title, summary, fullText].filter(Boolean).join(' ')
  const corpus = source.replace(/\s+/g, ' ')
  const normalizedCorpus = normalizeTopicLabelForMatching(corpus)
  const normalizedTitle = normalizeTopicLabelForMatching(title)

  return {
    extractionProfile,
    title,
    summary,
    fullText,
    corpus,
    normalizedCorpus,
    normalizedTitle,
  }
}

function buildCanonicalTopicRules() {
  const rules: CanonicalTopicRule[] = []

  for (const topic of curatedTopicTaxonomy) {
    const contextGatedAliasSet = new Set((topic.contextGatedAliases ?? []).map((alias) => normalizeTopicLabelForMatching(alias)))
    const allAliases = [topic.label, ...topic.aliases, ...(topic.contextGatedAliases ?? [])]
    const aliases = new Map<string, CanonicalAliasRule>()

    for (const alias of allAliases) {
      const normalizedAlias = normalizeTopicLabelForMatching(alias)

      if (!normalizedAlias) {
        continue
      }

      aliases.set(normalizedAlias, {
        normalizedAlias,
        requiresDefenseContext:
          contextGatedAliasSet.has(normalizedAlias) || aliasRequiresDefenseContext(alias),
      })
    }

    if (aliases.size === 0) {
      continue
    }

    rules.push({
      slug: topic.slug,
      label: topic.label,
      topicType: topic.topicType,
      aliases: [...aliases.values()],
    })
  }

  return rules
}

const canonicalTopicRules = buildCanonicalTopicRules()

function extractFromCanonicalRegistry(input: TopicExtractionInput, corpora: ReturnType<typeof buildCorpora>) {
  const extracted: ExtractedTopicCandidate[] = []
  const defenseContext = hasDefenseContext({
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    sourceCategory: input.sourceCategory,
    title: input.title,
    summary: input.summary,
    fullText: corpora.fullText,
  })

  for (const topic of canonicalTopicRules) {
    let occurrences = 0
    let matchedInTitle = false

    for (const alias of topic.aliases) {
      if (alias.requiresDefenseContext && !defenseContext) {
        continue
      }

      const aliasOccurrences = countOccurrences(corpora.normalizedCorpus, alias.normalizedAlias)

      if (aliasOccurrences <= 0) {
        continue
      }

      occurrences += aliasOccurrences
      if (!matchedInTitle && countOccurrences(corpora.normalizedTitle, alias.normalizedAlias) > 0) {
        matchedInTitle = true
      }
    }

    if (occurrences <= 0) {
      continue
    }

    if (isLowValueTopicLabel(topic.label)) {
      continue
    }

    const confidence = Math.min(0.99, 0.84 + Number(matchedInTitle) * 0.1 + Math.min(occurrences, 8) * 0.01)

    extracted.push({
      slug: topic.slug,
      label: topic.label,
      topicType: topic.topicType,
      occurrences,
      confidence,
      isPrimary: matchedInTitle || occurrences >= 3,
      matchedBy: 'taxonomy',
    })
  }

  return extracted
}

export function extractTopicsFromArticle(input: TopicExtractionInput): ExtractedTopicCandidate[] {
  const corpora = buildCorpora(input)

  if (!corpora.corpus) {
    return []
  }

  const canonicalMatches = extractFromCanonicalRegistry(input, corpora)

  return canonicalMatches
    .filter((topic) => topic.slug && topic.label)
    .filter((topic) => !isLowValueTopicLabel(topic.label))
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) {
        return Number(b.isPrimary) - Number(a.isPrimary)
      }

      const confidenceDiff = b.confidence - a.confidence
      if (confidenceDiff !== 0) {
        return confidenceDiff
      }

      const occurrenceDiff = b.occurrences - a.occurrences
      if (occurrenceDiff !== 0) {
        return occurrenceDiff
      }

      return a.label.localeCompare(b.label)
    })
    .slice(0, MAX_TOPICS_PER_ARTICLE)
}
