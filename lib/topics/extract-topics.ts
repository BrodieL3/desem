import {curatedTopicTaxonomy, type TopicType} from './taxonomy'
import {normalizeTopicKey, slugifyTopic} from './slug'

export interface TopicExtractionInput {
  title: string
  summary?: string | null
  fullText?: string | null
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

type TopicAccumulator = ExtractedTopicCandidate

const stopPhrases = new Set(
  [
    'The',
    'A',
    'An',
    'This',
    'That',
    'These',
    'Those',
    'Breaking News',
    'Defense News',
    'Field Brief',
    'Read More',
    'United States',
  ].map(normalizeTopicKey)
)

const organizationHints = ['department', 'command', 'agency', 'force', 'ministry', 'office', 'corps', 'navy', 'army']
const programHints = ['initiative', 'program', 'effort', 'procurement', 'contract', 'project']
const companyHints = ['inc', 'corp', 'corporation', 'llc', 'technologies', 'systems', 'group', 'defense']
const geographyHints = ['sea', 'ocean', 'middle east', 'europe', 'pacific', 'atlantic', 'ukraine', 'russia', 'china']

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countOccurrences(corpus: string, rawValue: string) {
  const value = rawValue.trim()

  if (!value) {
    return 0
  }

  const matcher = new RegExp(`\\b${escapeRegExp(value)}\\b`, 'gi')
  const matches = corpus.match(matcher)
  return matches?.length ?? 0
}

function buildCorpora(input: TopicExtractionInput) {
  const title = input.title.trim()
  const summary = (input.summary ?? '').trim()
  const fullText = (input.fullText ?? '').trim()

  const source = [title, summary, fullText].filter(Boolean).join(' ')
  const corpus = source.replace(/\s+/g, ' ')

  return {
    title,
    summary,
    fullText,
    corpus,
    normalizedCorpus: corpus.toLowerCase(),
    normalizedTitle: title.toLowerCase(),
  }
}

function detectTopicType(candidate: string): TopicType {
  const lowered = normalizeTopicKey(candidate)

  if (/^[A-Z0-9]{2,8}$/.test(candidate)) {
    return 'acronym'
  }

  if (companyHints.some((hint) => lowered.includes(hint))) {
    return 'company'
  }

  if (organizationHints.some((hint) => lowered.includes(hint))) {
    return 'organization'
  }

  if (programHints.some((hint) => lowered.includes(hint))) {
    return 'program'
  }

  if (geographyHints.some((hint) => lowered.includes(hint))) {
    return 'geography'
  }

  if (/(ai|radar|satellite|hypersonic|cyber|autonomy|missile|drone)/i.test(candidate)) {
    return 'technology'
  }

  if (/^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/.test(candidate)) {
    return 'person'
  }

  return 'organization'
}

function extractFromTaxonomy(input: ReturnType<typeof buildCorpora>) {
  const extracted: ExtractedTopicCandidate[] = []

  for (const topic of curatedTopicTaxonomy) {
    const aliases = new Set([topic.label, ...topic.aliases])

    let occurrences = 0
    let matchedInTitle = false

    for (const alias of aliases) {
      const aliasOccurrences = countOccurrences(input.corpus, alias)

      if (aliasOccurrences <= 0) {
        continue
      }

      occurrences += aliasOccurrences
      matchedInTitle ||= input.normalizedTitle.includes(alias.toLowerCase())
    }

    if (occurrences <= 0) {
      continue
    }

    const confidence = Math.min(0.99, 0.82 + Number(matchedInTitle) * 0.1 + Math.min(occurrences, 8) * 0.01)

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

function extractCandidateEntities(source: string) {
  const matches = new Map<string, number>()

  const acronymMatches = source.match(/\b[A-Z][A-Z0-9]{1,7}\b/g) ?? []
  for (const token of acronymMatches) {
    const value = token.trim()
    if (!value || value.length < 2) {
      continue
    }

    matches.set(value, (matches.get(value) ?? 0) + 1)
  }

  const phrasePattern = /\b([A-Z][A-Za-z0-9'&.-]+(?:\s+[A-Z][A-Za-z0-9'&.-]+){0,4})\b/g
  for (const raw of source.match(phrasePattern) ?? []) {
    const value = raw.trim()
    if (!value || value.length < 3) {
      continue
    }

    matches.set(value, (matches.get(value) ?? 0) + 1)
  }

  return matches
}

function extractWithHeuristicNer(input: ReturnType<typeof buildCorpora>) {
  const source = [input.title, input.summary, input.fullText.slice(0, 12000)].filter(Boolean).join(' ')
  const candidates = extractCandidateEntities(source)
  const extracted: ExtractedTopicCandidate[] = []

  for (const [label, baseHits] of candidates.entries()) {
    const normalized = normalizeTopicKey(label)

    if (stopPhrases.has(normalized)) {
      continue
    }

    if (!/^[A-Za-z0-9][A-Za-z0-9\s'&.-]*$/.test(label)) {
      continue
    }

    if (label.split(' ').length > 5) {
      continue
    }

    const occurrences = Math.max(baseHits, countOccurrences(input.corpus, label))

    if (occurrences <= 0) {
      continue
    }

    const inTitle = input.normalizedTitle.includes(normalized)
    const confidence = Math.min(0.84, 0.5 + Number(inTitle) * 0.14 + Math.min(occurrences, 6) * 0.03)

    extracted.push({
      slug: slugifyTopic(label),
      label,
      topicType: detectTopicType(label),
      occurrences,
      confidence,
      isPrimary: inTitle || occurrences >= 4,
      matchedBy: 'ner',
    })
  }

  return extracted
}

function buildAliasLookup() {
  const lookup = new Map<string, (typeof curatedTopicTaxonomy)[number]>()

  for (const topic of curatedTopicTaxonomy) {
    for (const alias of [topic.label, ...topic.aliases]) {
      lookup.set(normalizeTopicKey(alias), topic)
    }
  }

  return lookup
}

const aliasLookup = buildAliasLookup()

function mergeCandidates(candidates: ExtractedTopicCandidate[]) {
  const merged = new Map<string, TopicAccumulator>()

  for (const candidate of candidates) {
    const canonicalMatch = aliasLookup.get(normalizeTopicKey(candidate.label))

    const normalizedCandidate: ExtractedTopicCandidate = canonicalMatch
      ? {
          ...candidate,
          slug: canonicalMatch.slug,
          label: canonicalMatch.label,
          topicType: canonicalMatch.topicType,
          confidence: Math.max(candidate.confidence, 0.86),
          matchedBy: candidate.matchedBy,
        }
      : candidate

    const existing = merged.get(normalizedCandidate.slug)

    if (!existing) {
      merged.set(normalizedCandidate.slug, normalizedCandidate)
      continue
    }

    merged.set(normalizedCandidate.slug, {
      ...existing,
      label: existing.label.length >= normalizedCandidate.label.length ? existing.label : normalizedCandidate.label,
      topicType: existing.topicType,
      occurrences: existing.occurrences + normalizedCandidate.occurrences,
      confidence: Math.min(0.99, Math.max(existing.confidence, normalizedCandidate.confidence) + 0.01),
      isPrimary: existing.isPrimary || normalizedCandidate.isPrimary,
      matchedBy: existing.matchedBy === 'taxonomy' || normalizedCandidate.matchedBy === 'taxonomy' ? 'taxonomy' : 'ner',
    })
  }

  return [...merged.values()]
}

export function extractTopicsFromArticle(input: TopicExtractionInput): ExtractedTopicCandidate[] {
  const corpora = buildCorpora(input)

  if (!corpora.corpus) {
    return []
  }

  const taxonomyMatches = extractFromTaxonomy(corpora)
  const nerMatches = extractWithHeuristicNer(corpora)
  const merged = mergeCandidates([...taxonomyMatches, ...nerMatches])

  return merged
    .filter((topic) => topic.slug && topic.label)
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
    .slice(0, 24)
}
