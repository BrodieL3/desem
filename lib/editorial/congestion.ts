import type {CongestionEvaluation, StoryCluster} from './types'

export type CongestionRules = {
  minArticles: number
  minSources: number
  windowHours: number
}

export const defaultCongestionRules: CongestionRules = {
  minArticles: 10,
  minSources: 6,
  windowHours: 24,
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function evaluateClusterCongestion(
  cluster: StoryCluster,
  options?: {
    now?: Date
    rules?: CongestionRules
  }
): CongestionEvaluation {
  const rules = options?.rules ?? defaultCongestionRules
  const nowMs = (options?.now ?? new Date()).getTime()
  const minTimestamp = nowMs - rules.windowHours * 60 * 60 * 1000

  const recentMembers = cluster.members.filter((member) => {
    const timestamp = parseTimestamp(member.article.publishedAt ?? member.article.fetchedAt)
    return timestamp >= minTimestamp
  })

  const articleCount24h = recentMembers.length
  const uniqueSources24h = new Set(recentMembers.map((member) => member.article.sourceId)).size

  const articleComponent = Math.min(1, articleCount24h / Math.max(1, rules.minArticles))
  const sourceComponent = Math.min(1, uniqueSources24h / Math.max(1, rules.minSources))
  const congestionScore = Number((articleComponent * 0.6 + sourceComponent * 0.4).toFixed(3))

  return {
    articleCount24h,
    uniqueSources24h,
    congestionScore,
    isCongested: articleCount24h >= rules.minArticles && uniqueSources24h >= rules.minSources,
  }
}
