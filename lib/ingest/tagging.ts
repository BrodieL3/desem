import type {PulledArticle} from './pull-defense-articles'

export type BriefingTrack = 'macro' | 'programs' | 'tech' | 'capital'
export type ContentType = 'conflict' | 'program' | 'budget' | 'policy' | 'funding' | 'tech'

export interface ClassifiedArticleTags {
  missionTags: string[]
  domainTags: string[]
  technologyTags: string[]
  track: BriefingTrack
  contentType: ContentType
  highImpact: boolean
}

type KeywordRule = {
  label: string
  keywords: string[]
}

const missionRules: KeywordRule[] = [
  {
    label: 'Counter-UAS',
    keywords: ['counter-uas', 'counter uas', 'drone', 'uav', 'uas', 'loitering munition'],
  },
  {
    label: 'Joint C2',
    keywords: ['joint c2', 'command and control', 'battle management', 'c2', 'joint all-domain command'],
  },
  {
    label: 'Resilient Comms',
    keywords: ['satcom', 'communications', 'network resilience', 'secure comms', 'tactical network'],
  },
  {
    label: 'Contested Logistics',
    keywords: ['logistics', 'sealift', 'airlift', 'sustainment', 'supply route', 'contested logistics'],
  },
  {
    label: 'Force Protection',
    keywords: ['force protection', 'air defense', 'base defense', 'protection', 'defensive posture'],
  },
  {
    label: 'Homeland Defense',
    keywords: ['homeland defense', 'border security', 'northcom', 'domestic security'],
  },
  {
    label: 'Industrial Base',
    keywords: ['industrial base', 'supplier', 'production line', 'manufacturing', 'factory', 'capacity'],
  },
  {
    label: 'Munitions',
    keywords: ['munitions', 'missile', 'rocket', 'artillery shell', 'precision-guided'],
  },
  {
    label: 'Supply Chain',
    keywords: ['supply chain', 'second source', 'long lead', 'component shortage', 'material lead time'],
  },
  {
    label: 'ISR',
    keywords: ['isr', 'intelligence surveillance', 'reconnaissance', 'sensor payload', 'surveillance'],
  },
  {
    label: 'Autonomy',
    keywords: ['autonomy', 'autonomous', 'robot wingman', 'uncrewed', 'unmanned', 'swarm'],
  },
  {
    label: 'Joint Fires',
    keywords: ['joint fires', 'strike', 'targeting', 'fires', 'long-range fires'],
  },
  {
    label: 'Defense Software',
    keywords: ['mission software', 'software platform', 'devsecops', 'software factory', 'digital platform'],
  },
  {
    label: 'Deterrence',
    keywords: ['deterrence', 'nuclear posture', 'strategic stability', 'extended deterrence'],
  },
]

const domainRules: KeywordRule[] = [
  {
    label: 'land',
    keywords: ['army', 'ground force', 'brigade', 'tank', 'armored', 'artillery'],
  },
  {
    label: 'air',
    keywords: ['air force', 'usaf', 'fighter', 'bomber', 'aircraft', 'aviation'],
  },
  {
    label: 'maritime',
    keywords: ['navy', 'marine corps', 'maritime', 'naval', 'warship', 'carrier', 'submarine', 'fleet'],
  },
  {
    label: 'space',
    keywords: ['space force', 'space domain', 'orbital', 'satellite', 'launch', 'leo', 'geo'],
  },
  {
    label: 'cyber',
    keywords: ['cyber', 'cybersecurity', 'network defense', 'zero trust', 'cyber command'],
  },
  {
    label: 'multi-domain',
    keywords: ['joint force', 'multi-domain', 'joint all-domain', 'cross-domain'],
  },
]

const technologyRules: KeywordRule[] = [
  {
    label: 'SATCOM',
    keywords: ['satcom', 'satellite communications'],
  },
  {
    label: 'Network Orchestration',
    keywords: ['network orchestration', 'mesh network', 'software-defined network', 'network command'],
  },
  {
    label: 'Terminal Integration',
    keywords: ['terminal integration', 'ground terminal', 'user terminal', 'modem integration'],
  },
  {
    label: 'RF sensing',
    keywords: ['rf sensing', 'radio frequency sensing', 'rf sensor', 'electromagnetic sensing'],
  },
  {
    label: 'EO/IR',
    keywords: ['eo/ir', 'electro-optical', 'infrared sensor', 'electro optical'],
  },
  {
    label: 'Edge AI',
    keywords: ['edge ai', 'onboard ai', 'edge inference', 'real-time ai'],
  },
  {
    label: 'Advanced Manufacturing',
    keywords: ['advanced manufacturing', 'additive manufacturing', '3d printing', 'factory automation'],
  },
  {
    label: 'Digital Twins',
    keywords: ['digital twin', 'digital thread', 'model-based systems engineering', 'mbse'],
  },
  {
    label: 'Propulsion',
    keywords: ['propulsion', 'engine', 'rocket motor', 'turbine'],
  },
  {
    label: 'AI/ML',
    keywords: ['ai/ml', 'machine learning', 'artificial intelligence', 'ml model'],
  },
  {
    label: 'Mission Software',
    keywords: ['mission software', 'software update', 'battle management software', 'command software'],
  },
  {
    label: 'Edge Compute',
    keywords: ['edge compute', 'onboard compute', 'distributed compute', 'tactical compute'],
  },
]

const contentTypeKeywords: Record<Exclude<ContentType, 'program'>, string[]> = {
  conflict: ['war', 'strike', 'attack', 'combat', 'battlefield', 'conflict', 'invasion'],
  budget: ['budget', 'appropriation', 'appropriations', 'spending bill', 'fy', 'continuing resolution'],
  policy: ['policy', 'directive', 'strategy', 'guidance', 'executive order', 'hearing', 'sanctions'],
  funding: ['funding', 'fundraise', 'investment', 'venture', 'series a', 'series b', 'valuation'],
  tech: ['autonomous', 'software', 'cyber', 'ai', 'radar', 'sensor', 'satcom', 'prototype'],
}

const highImpactKeywords = [
  'nuclear',
  'carrier strike group',
  'contracts for',
  'hypersonic',
  'budget request',
  'deterrence',
  'missile defense',
]

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function buildCorpus(article: Pick<PulledArticle, 'title' | 'summary' | 'url' | 'sourceName'>) {
  return normalize(`${article.title} ${article.summary} ${article.url} ${article.sourceName}`)
}

function scoreRule(corpus: string, keywords: string[]) {
  let score = 0

  for (const keyword of keywords) {
    const normalizedKeyword = normalize(keyword)
    if (!normalizedKeyword) {
      continue
    }

    if (corpus.includes(normalizedKeyword)) {
      score += 1
    }
  }

  return score
}

function rankRules(corpus: string, rules: KeywordRule[]) {
  return rules
    .map((rule) => ({
      label: rule.label,
      score: scoreRule(corpus, rule.keywords),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
}

function resolveContentType(corpus: string): ContentType {
  const ranked = Object.entries(contentTypeKeywords)
    .map(([contentType, keywords]) => ({
      contentType: contentType as Exclude<ContentType, 'program'>,
      score: scoreRule(corpus, keywords),
    }))
    .sort((a, b) => b.score - a.score)

  if (ranked[0] && ranked[0].score > 0) {
    return ranked[0].contentType
  }

  return 'program'
}

function resolveTrack(contentType: ContentType): BriefingTrack {
  if (contentType === 'funding') {
    return 'capital'
  }

  if (contentType === 'budget' || contentType === 'policy' || contentType === 'conflict') {
    return 'macro'
  }

  if (contentType === 'tech') {
    return 'tech'
  }

  return 'programs'
}

export function classifyPulledArticle(article: PulledArticle): ClassifiedArticleTags {
  const corpus = buildCorpus(article)

  const missionTags = rankRules(corpus, missionRules)
    .slice(0, 4)
    .map((entry) => entry.label)

  const domainTags = rankRules(corpus, domainRules)
    .slice(0, 2)
    .map((entry) => entry.label)

  const technologyTags = rankRules(corpus, technologyRules)
    .slice(0, 5)
    .map((entry) => entry.label)

  const contentType = resolveContentType(corpus)
  const track = resolveTrack(contentType)
  const highImpact = highImpactKeywords.some((keyword) => corpus.includes(keyword))

  if (domainTags.length === 0) {
    domainTags.push('multi-domain')
  }

  if (missionTags.length === 0 && article.sourceCategory === 'official') {
    missionTags.push('Industrial Base')
  }

  return {
    missionTags,
    domainTags,
    technologyTags,
    track,
    contentType,
    highImpact,
  }
}
