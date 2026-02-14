import {sanitizePlainText} from '@/lib/utils'

type TopicTypeLike = 'organization' | 'program' | 'technology' | 'company' | 'geography' | 'acronym' | 'person'

type TopicLike = {
  label: string
  topicType?: TopicTypeLike | null
}

type FocusInput = {
  title: string
  summary?: string | null
  topicLabel?: string | null
  topics?: TopicLike[]
}

export type EditorialFocusBucket = 'international' | 'us-defense-company' | 'mixed' | 'other'

const usDefenseCompanyTerms = [
  'anduril',
  'palantir',
  'lockheed martin',
  'raytheon',
  'rtx',
  'northrop grumman',
  'boeing defense',
  'general dynamics',
  'l3harris',
  'leidos',
  'huntington ingalls',
  'aerovironment',
  'kratos',
  'caci',
  'saic',
  'bae systems inc',
]

const internationalTerms = [
  'ukraine',
  'russia',
  'china',
  'taiwan',
  'indo-pacific',
  'middle east',
  'europe',
  'nato',
  'israel',
  'iran',
  'south china sea',
  'red sea',
  'baltic',
  'pacific',
  'gulf',
]

function normalize(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  return sanitizePlainText(value).toLowerCase().replace(/\s+/g, ' ').trim()
}

function containsAny(text: string, terms: readonly string[]) {
  return terms.some((term) => text.includes(term))
}

function isUsDefenseCompanyLabel(label: string) {
  const normalized = normalize(label)
  return containsAny(normalized, usDefenseCompanyTerms)
}

function isInternationalLabel(label: string) {
  const normalized = normalize(label)

  if (!normalized || normalized === 'united states' || normalized === 'us') {
    return false
  }

  return containsAny(normalized, internationalTerms)
}

export function classifyEditorialFocus(input: FocusInput): EditorialFocusBucket {
  const normalizedTitle = normalize(input.title)
  const normalizedSummary = normalize(input.summary)
  const normalizedTopicLabel = normalize(input.topicLabel)
  const aggregateText = [normalizedTitle, normalizedSummary, normalizedTopicLabel].filter(Boolean).join(' ')

  let hasCompany = containsAny(aggregateText, usDefenseCompanyTerms)
  let hasInternational = containsAny(aggregateText, internationalTerms)

  for (const topic of input.topics ?? []) {
    if (!topic.label) {
      continue
    }

    if (topic.topicType === 'company' && isUsDefenseCompanyLabel(topic.label)) {
      hasCompany = true
    }

    if (topic.topicType === 'geography' && isInternationalLabel(topic.label)) {
      hasInternational = true
    }
  }

  if (hasCompany && hasInternational) {
    return 'mixed'
  }

  if (hasInternational) {
    return 'international'
  }

  if (hasCompany) {
    return 'us-defense-company'
  }

  return 'other'
}

export function isEditorialFocusMatch(input: FocusInput) {
  return classifyEditorialFocus(input) !== 'other'
}

export function editorialFocusScoreBoost(bucket: EditorialFocusBucket) {
  switch (bucket) {
    case 'mixed':
      return 60_000
    case 'international':
      return 40_000
    case 'us-defense-company':
      return 35_000
    default:
      return 0
  }
}
