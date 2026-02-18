import type {CuratedStoryCard} from '@/lib/editorial/ui-types'

type HomeSlotKey = 'signals' | 'world' | 'industry'

export type HomeEditionLayout = {
  lead: CuratedStoryCard | null
  signals: CuratedStoryCard[]
  world: CuratedStoryCard[]
  industry: CuratedStoryCard[]
  wire: CuratedStoryCard[]
}

const WORLD_PATTERNS = [
  /\bnato\b/i,
  /\bukraine\b/i,
  /\brussia\b/i,
  /\bchina\b/i,
  /\btaiwan\b/i,
  /\bmiddle east\b/i,
  /\bred sea\b/i,
  /\biran\b/i,
  /\bisrael\b/i,
  /\beurope\b/i,
  /\bsouth china sea\b/i,
  /\bforeign ministry\b/i,
  /\bborder\b/i,
]

const INDUSTRY_PATTERNS = [
  /\bcontract\b/i,
  /\baward\b/i,
  /\bproduction\b/i,
  /\bshipyard\b/i,
  /\bearnings\b/i,
  /\bbacklog\b/i,
  /\bacquisition\b/i,
  /\bmerger\b/i,
  /\bboeing\b/i,
  /\blockheed\b/i,
  /\braytheon\b/i,
  /\bnorthrop\b/i,
  /\banduril\b/i,
  /\bl3harris\b/i,
  /\bgeneral dynamics\b/i,
  /\bpalantir\b/i,
]

const SIGNAL_PATTERNS = [
  /\bmissile\b/i,
  /\bdrone\b/i,
  /\bcyber\b/i,
  /\bstrike\b/i,
  /\battack\b/i,
  /\bexercise\b/i,
  /\bdeployment\b/i,
  /\bintercept\b/i,
  /\bsatellite\b/i,
  /\bcarrier\b/i,
]

function compact(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function matchScore(text: string, patterns: RegExp[]) {
  let score = 0

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      score += 1
    }
  }

  return score
}

type RankedStory = {
  story: CuratedStoryCard
  index: number
  signalScore: number
  worldScore: number
  industryScore: number
}

function rankStories(stories: CuratedStoryCard[]) {
  return stories.map((story, index): RankedStory => {
    const text = [
      compact(story.headline),
      compact(story.dek),
      compact(story.whyItMatters),
      compact(story.sourceName),
    ]
      .filter(Boolean)
      .join(' ')

    const signalScore = matchScore(text, SIGNAL_PATTERNS) + (story.riskLevel === 'high' ? 2 : story.riskLevel === 'medium' ? 1 : 0)
    const worldScore = matchScore(text, WORLD_PATTERNS)
    const industryScore = matchScore(text, INDUSTRY_PATTERNS)

    return {
      story,
      index,
      signalScore,
      worldScore,
      industryScore,
    }
  })
}

function fillSlot(input: {
  ranked: RankedStory[]
  used: Set<string>
  key: HomeSlotKey
  limit: number
}) {
  const scoreSelector: Record<HomeSlotKey, (story: RankedStory) => number> = {
    signals: (story) => story.signalScore,
    world: (story) => story.worldScore,
    industry: (story) => story.industryScore,
  }

  const selector = scoreSelector[input.key]
  const selected: CuratedStoryCard[] = []

  const primaryPool = [...input.ranked]
    .filter((story) => !input.used.has(story.story.clusterKey) && selector(story) > 0)
    .sort((left, right) => selector(right) - selector(left) || left.index - right.index)

  for (const candidate of primaryPool) {
    selected.push(candidate.story)
    input.used.add(candidate.story.clusterKey)

    if (selected.length >= input.limit) {
      return selected
    }
  }

  for (const candidate of input.ranked) {
    if (input.used.has(candidate.story.clusterKey)) {
      continue
    }

    selected.push(candidate.story)
    input.used.add(candidate.story.clusterKey)

    if (selected.length >= input.limit) {
      break
    }
  }

  return selected
}

export function buildHomeEditionLayout(stories: CuratedStoryCard[]): HomeEditionLayout {
  if (stories.length === 0) {
    return {
      lead: null,
      signals: [],
      world: [],
      industry: [],
      wire: [],
    }
  }

  const lead = stories[0] ?? null

  if (!lead) {
    return {
      lead: null,
      signals: [],
      world: [],
      industry: [],
      wire: [],
    }
  }

  const ranked = rankStories(stories.slice(1))
  const used = new Set<string>([lead.clusterKey])

  const signals = fillSlot({
    ranked,
    used,
    key: 'signals',
    limit: 6,
  })
  const world = fillSlot({
    ranked,
    used,
    key: 'world',
    limit: 6,
  })
  const industry = fillSlot({
    ranked,
    used,
    key: 'industry',
    limit: 6,
  })

  const wire = ranked.filter((story) => !used.has(story.story.clusterKey)).map((story) => story.story)

  return {
    lead,
    signals,
    world,
    industry,
    wire,
  }
}

