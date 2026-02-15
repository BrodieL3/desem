import type {DefenseMoneyAwardTransaction, DefenseMoneyBucket} from './types'

type BucketRule = {
  bucket: DefenseMoneyBucket
  pscPrefixes: string[]
  naicsPrefixes: string[]
  keywords: RegExp[]
}

type BucketScore = {
  bucket: DefenseMoneyBucket
  score: number
}

const BUCKET_PRIORITY: DefenseMoneyBucket[] = ['ai_ml', 'c5isr', 'space', 'autonomy', 'cyber', 'munitions', 'ew', 'counter_uas']

const RULES: BucketRule[] = [
  {
    bucket: 'ai_ml',
    pscPrefixes: ['AJ', 'B54', 'D31', 'D32'],
    naicsPrefixes: ['541511', '541512', '541715'],
    keywords: [/artificial intelligence/i, /machine learning/i, /computer vision/i, /foundation model/i, /autonomous targeting/i],
  },
  {
    bucket: 'c5isr',
    pscPrefixes: ['D3', 'D7', 'N06', '5810', '5895'],
    naicsPrefixes: ['334220', '541330', '541519'],
    keywords: [/c5isr/i, /command and control/i, /battle management/i, /communications/i, /ISR/i, /sensor fusion/i],
  },
  {
    bucket: 'space',
    pscPrefixes: ['1810', '1820', '1830', '5865'],
    naicsPrefixes: ['336414', '927110'],
    keywords: [/space/i, /satellite/i, /launch/i, /orbital/i, /space domain awareness/i],
  },
  {
    bucket: 'autonomy',
    pscPrefixes: ['1550', '2355', '6910'],
    naicsPrefixes: ['336411', '336413'],
    keywords: [/autonomous/i, /unmanned/i, /UAV/i, /USV/i, /uncrewed/i, /robotic/i],
  },
  {
    bucket: 'cyber',
    pscPrefixes: ['D3', 'D7', 'R425'],
    naicsPrefixes: ['541512', '541519'],
    keywords: [/cyber/i, /zero trust/i, /endpoint/i, /network defense/i, /red team/i],
  },
  {
    bucket: 'munitions',
    pscPrefixes: ['13', '14', '15', '16'],
    naicsPrefixes: ['33299', '325920'],
    keywords: [/munition/i, /missile/i, /rocket/i, /ammunition/i, /warhead/i],
  },
  {
    bucket: 'ew',
    pscPrefixes: ['5865', '5826'],
    naicsPrefixes: ['334511', '541330'],
    keywords: [/electronic warfare/i, /EW /i, /jamming/i, /radar warning/i, /spectrum operations/i],
  },
  {
    bucket: 'counter_uas',
    pscPrefixes: ['5865', '5841'],
    naicsPrefixes: ['334511', '336411'],
    keywords: [/counter[- ]?uas/i, /counter[- ]?drone/i, /drone defeat/i, /low altitude air defense/i],
  },
]

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function startsWithAny(source: string, prefixes: string[]) {
  return prefixes.some((prefix) => source.startsWith(prefix))
}

function scoreBucket(input: {
  transaction: Pick<DefenseMoneyAwardTransaction, 'pscCode' | 'naicsCode' | 'transactionDescription'>
  rule: BucketRule
}): number {
  const pscCode = compact(input.transaction.pscCode).toUpperCase()
  const naicsCode = compact(input.transaction.naicsCode)
  const description = compact(input.transaction.transactionDescription)

  let score = 0

  if (pscCode && startsWithAny(pscCode, input.rule.pscPrefixes)) {
    score += 3
  }

  if (naicsCode && startsWithAny(naicsCode, input.rule.naicsPrefixes)) {
    score += 2
  }

  for (const keyword of input.rule.keywords) {
    if (keyword.test(description)) {
      score += 2
    }
  }

  return score
}

function rankBuckets(transaction: Pick<DefenseMoneyAwardTransaction, 'pscCode' | 'naicsCode' | 'transactionDescription'>) {
  return RULES.map((rule): BucketScore => ({
    bucket: rule.bucket,
    score: scoreBucket({
      transaction,
      rule,
    }),
  })).sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score
    }

    return BUCKET_PRIORITY.indexOf(left.bucket) - BUCKET_PRIORITY.indexOf(right.bucket)
  })
}

export function classifyDefenseMoneyBucket(transaction: Pick<DefenseMoneyAwardTransaction, 'pscCode' | 'naicsCode' | 'transactionDescription'>) {
  const ranked = rankBuckets(transaction)
  const tags = ranked.filter((entry) => entry.score > 0).map((entry) => entry.bucket)

  const primary = tags[0] ?? 'c5isr'

  return {
    primary,
    tags: tags.length > 0 ? tags : [primary],
    scores: ranked,
  }
}
