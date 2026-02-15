import {getDefenseFeedSourceById} from '@/lib/ingest/sources'

import {curatedTopicTaxonomy} from './taxonomy'

export type DefenseContextInput = {
  sourceId?: string | null
  sourceName?: string | null
  sourceCategory?: string | null
  title?: string | null
  summary?: string | null
  fullText?: string | null
}

const explicitNoiseSingleTokens = new Set(['and', 'but', 'for'])

const lowValueSingleTokens = new Set([
  ...explicitNoiseSingleTokens,
  'a',
  'an',
  'the',
  'this',
  'that',
  'these',
  'those',
  'today',
  'yesterday',
  'tomorrow',
  'breaking',
  'update',
  'updates',
  'news',
  'live',
  'video',
  'watch',
  'audio',
  'podcast',
  'share',
  'comment',
  'comments',
  'opinion',
  'analysis',
])

const dayAndMonthTokens = new Set([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'mon',
  'tue',
  'wed',
  'thu',
  'thur',
  'thurs',
  'fri',
  'sat',
  'sun',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
])

const datelineCityTokens = new Set([
  'washington',
  'london',
  'brussels',
  'moscow',
  'kyiv',
  'kiev',
  'paris',
  'berlin',
  'tokyo',
  'beijing',
])

const headlineJunkPatterns = [
  /\bread more\b/i,
  /\bcontinue reading\b/i,
  /\blive updates?\b/i,
  /\blive blog\b/i,
  /\bnewsletter\b/i,
  /\bclick here\b/i,
  /\bwatch (?:now|live)\b/i,
  /\bwhat you need to know\b/i,
  /\bkey takeaways?\b/i,
  /\bfull transcript\b/i,
  /\bphoto gallery\b/i,
  /\brelated (?:story|stories)\b/i,
  /\bupdated at\b/i,
]

const datelineFragmentPatterns = [
  /\((?:reuters|ap|associated press|afp)\)/i,
  /^(?:updated|added|published|last updated|last modified)\b/i,
  /^(?:[A-Z][A-Za-z.'-]+,\s*){1,4}[A-Z][A-Za-z.'-]+\s*[—-]/,
  /^[A-Z]{3,}(?:\s+[A-Z]{3,}){0,3}\s*[—-]/,
  /^(?:mon|tue|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+[A-Za-z]+\s+\d{1,2}(?:,\s*\d{4})?/i,
  /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+\d{1,2}(?:,\s*\d{4})?$/i,
]

const defenseContextPatterns = [
  /\bdefense\b/i,
  /\bpentagon\b/i,
  /\bmilitary\b/i,
  /\bmissile\b/i,
  /\barmy\b/i,
  /\bnavy\b/i,
  /\bair force\b/i,
  /\bspace force\b/i,
  /\bmarine corps\b/i,
  /\bdod\b/i,
  /\bdarpa\b/i,
  /\bnato\b/i,
  /\bcentcom\b/i,
  /\bindopacom\b/i,
]

const defenseContextSourceNamePatterns = [/defense/i, /military/i, /ministry of defence/i, /pentagon/i, /army/i, /navy/i]
const contextGatedAliases = new Set(['dow'])

function buildTaxonomyLookup() {
  const lookup = new Set<string>()

  for (const topic of curatedTopicTaxonomy) {
    for (const alias of [topic.label, ...topic.aliases, ...(topic.contextGatedAliases ?? [])]) {
      const normalized = normalizeTopicLabelForMatching(alias)

      if (normalized) {
        lookup.add(normalized)
      }
    }
  }

  return lookup
}

const taxonomyLabelLookup = buildTaxonomyLookup()

export function normalizeTopicLabelForMatching(label: string) {
  return label
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, ' ')
    .replace(/[^a-z0-9\s/&.+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function aliasRequiresDefenseContext(alias: string) {
  const normalized = normalizeTopicLabelForMatching(alias)
  return contextGatedAliases.has(normalized)
}

export function hasDefenseContext(input: DefenseContextInput) {
  const sourceCategory = normalizeTopicLabelForMatching(input.sourceCategory ?? '')

  if (sourceCategory === 'official') {
    return true
  }

  if (getDefenseFeedSourceById(input.sourceId ?? null)) {
    return true
  }

  const sourceName = `${input.sourceName ?? ''}`.trim()

  if (sourceName && defenseContextSourceNamePatterns.some((pattern) => pattern.test(sourceName))) {
    return true
  }

  const articleText = [input.title ?? '', input.summary ?? '', input.fullText ?? ''].join(' ')

  if (!articleText.trim()) {
    return false
  }

  return defenseContextPatterns.some((pattern) => pattern.test(articleText))
}

export function isLowValueTopicLabel(label: string) {
  const normalized = normalizeTopicLabelForMatching(label)

  if (!normalized) {
    return true
  }

  if (taxonomyLabelLookup.has(normalized)) {
    return false
  }

  if (normalized.length < 3 || /^[-.]+$/.test(normalized) || /^\d+$/.test(normalized)) {
    return true
  }

  if (headlineJunkPatterns.some((pattern) => pattern.test(normalized))) {
    return true
  }

  const compactOriginal = label.trim()
  if (compactOriginal && datelineFragmentPatterns.some((pattern) => pattern.test(compactOriginal))) {
    return true
  }

  const words = normalized.split(' ')

  if (words.length === 0) {
    return true
  }

  if (words.length > 7) {
    return true
  }

  if (words.length === 1) {
    const token = words[0]

    if (!token) {
      return true
    }

    if (lowValueSingleTokens.has(token) || dayAndMonthTokens.has(token) || datelineCityTokens.has(token)) {
      return true
    }
  }

  const hasOnlyCalendarTokens = words.every((token) => dayAndMonthTokens.has(token) || /^\d{1,4}$/.test(token))
  if (hasOnlyCalendarTokens) {
    return true
  }

  if (/https?:\/\//.test(normalized) || normalized.includes('@')) {
    return true
  }

  return false
}
