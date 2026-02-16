import {defenseMoneyBucketValues, type DefenseMoneyActionLens, type DefenseMoneyBucket, type DefenseMoneyChartSummary, type DefenseMoneyCitation, type DefenseMoneySummaryClaim} from './types'

const BUILD_BUCKETS = new Set<DefenseMoneyBucket>(['ai_ml', 'autonomy', 'space'])
const SELL_BUCKETS = new Set<DefenseMoneyBucket>(['munitions', 'ew', 'counter_uas'])

function normalizeBucketMomentum(momentum: Partial<Record<DefenseMoneyBucket, number>>) {
  return defenseMoneyBucketValues.map((bucket) => ({
    bucket,
    value: Number(momentum[bucket] ?? 0),
  }))
}

export function resolveActionLensFromBucket(bucket: DefenseMoneyBucket | null | undefined): DefenseMoneyActionLens {
  if (!bucket) {
    return 'partner'
  }

  if (BUILD_BUCKETS.has(bucket)) {
    return 'build'
  }

  if (SELL_BUCKETS.has(bucket)) {
    return 'sell'
  }

  return 'partner'
}

export function resolveActionLensFromMomentum(momentum: Partial<Record<DefenseMoneyBucket, number>>): DefenseMoneyActionLens {
  const sorted = normalizeBucketMomentum(momentum).sort((left, right) => right.value - left.value)
  const strongest = sorted[0]

  if (!strongest) {
    return 'partner'
  }

  if (strongest.value <= 0) {
    return 'partner'
  }

  return resolveActionLensFromBucket(strongest.bucket)
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

type DeterministicClaimInput = {
  id: string
  text: string
  citationIds: string[]
}

type BuildDeterministicChartSummaryInput = {
  headline: string
  actionLens: DefenseMoneyActionLens
  soWhat: string
  claims: DeterministicClaimInput[]
  citations: DefenseMoneyCitation[]
  sourceGapNote?: string
}

export function buildDeterministicChartSummary(input: BuildDeterministicChartSummaryInput): DefenseMoneyChartSummary {
  const citationById = new Map<string, DefenseMoneyCitation>(
    input.citations
      .map((citation) => ({
        id: compact(citation.id),
        label: compact(citation.label),
        url: compact(citation.url),
        sourceLabel: compact(citation.sourceLabel) || undefined,
      }))
      .filter((citation) => citation.id && citation.label && citation.url)
      .map((citation) => [citation.id, citation] as [string, DefenseMoneyCitation])
  )

  const validClaims: DefenseMoneySummaryClaim[] = []

  for (const claim of input.claims) {
    const text = compact(claim.text)

    if (!text) {
      continue
    }

    const citationIds = claim.citationIds
      .map((id) => compact(id))
      .filter((id, index, all) => Boolean(id) && all.indexOf(id) === index && citationById.has(id))

    if (citationIds.length === 0) {
      continue
    }

    validClaims.push({
      id: compact(claim.id) || `claim-${validClaims.length + 1}`,
      text,
      citationIds,
    })
  }

  if (validClaims.length === 0) {
    return {
      headline: input.headline,
      actionLens: input.actionLens,
      soWhat: input.soWhat,
      claims: [],
      citations: [],
      sourceGapNote: input.sourceGapNote ?? 'Source gap: insufficient citation-resolvable evidence for claims.',
    }
  }

  const usedCitationIds = new Set(validClaims.flatMap((claim) => claim.citationIds))
  const citations = [...usedCitationIds]
    .map((id) => citationById.get(id) ?? null)
    .filter((citation): citation is DefenseMoneyCitation => citation !== null)

  return {
    headline: input.headline,
    actionLens: input.actionLens,
    soWhat: input.soWhat,
    claims: validClaims,
    citations,
  }
}
