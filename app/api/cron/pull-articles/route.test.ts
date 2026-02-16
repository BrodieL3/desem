import {afterEach, beforeEach, describe, expect, it, mock} from 'bun:test'

type MockState = {
  pullError: Error | null
  semaphorResult: {
    fetchedStories: number
    processed: number
    synced: number
    failed: number
    errors: Array<{
      storyId: string
      articleUrl: string
      message: string
    }>
  }
  primeResult: {
    runId: string
    processedCompanies: number
    processedPeriods: number
    warnings: string[]
  }
  moneyResult: {
    runId: string | null
    status: 'succeeded' | 'partial_failed' | 'failed'
    processedTransactions: number
    processedTickers: number
    processedBriefs: number
    warnings: string[]
    error: string | null
    targetDate: string
  }
}

const state: MockState = {
  pullError: null,
  semaphorResult: {
    fetchedStories: 2,
    processed: 2,
    synced: 2,
    failed: 0,
    errors: [],
  },
  primeResult: {
    runId: 'prime-run-1',
    processedCompanies: 6,
    processedPeriods: 6,
    warnings: [],
  },
  moneyResult: {
    runId: 'money-run-1',
    status: 'succeeded',
    processedTransactions: 4,
    processedTickers: 6,
    processedBriefs: 6,
    warnings: [],
    error: null,
    targetDate: '2026-02-13',
  },
}

function resetState() {
  state.pullError = null
  state.semaphorResult = {
    fetchedStories: 2,
    processed: 2,
    synced: 2,
    failed: 0,
    errors: [],
  }
  state.primeResult = {
    runId: 'prime-run-1',
    processedCompanies: 6,
    processedPeriods: 6,
    warnings: [],
  }
  state.moneyResult = {
    runId: 'money-run-1',
    status: 'succeeded',
    processedTransactions: 4,
    processedTickers: 6,
    processedBriefs: 6,
    warnings: [],
    error: null,
    targetDate: '2026-02-13',
  }
}

mock.module('@/lib/editorial/semaphor-sync', () => ({
  syncSemaphorSecurityNewsItemsToSanity: async () => state.semaphorResult,
}))

mock.module('@/lib/data/signals/sync', () => ({
  syncDefenseMoneySignals: async () => state.moneyResult,
  syncDefenseGovContracts: async () => ({status: 'succeeded', contractCount: 0, warnings: [], error: null}),
  syncSamGovOpportunities: async () => ({status: 'succeeded', opportunityCount: 0, warnings: [], error: null}),
}))

mock.module('@/lib/data/signals/cross-reference', () => ({
  linkArticlesToContracts: async () => ({linkedCount: 0, warnings: []}),
}))

mock.module('@/lib/data/primes/sync', () => ({
  syncPrimeMetricsFromSec: async () => state.primeResult,
}))

mock.module('@/lib/ingest/pull-defense-articles', () => ({
  pullDefenseArticles: async () => {
    if (state.pullError) {
      throw state.pullError
    }

    return {
      fetchedAt: '2026-02-13T11:00:00.000Z',
      sourceCount: 1,
      articleCount: 1,
      articles: [],
      errors: [],
    }
  },
}))

mock.module('@/lib/ingest/persist', () => ({
  createSupabaseAdminClientFromEnv: () => ({}),
  upsertPullResultToSupabase: async () => ({
    upsertedSourceCount: 1,
    upsertedArticleCount: 1,
    usedLegacySchema: false,
  }),
}))

mock.module('@/lib/ingest/enrich-articles', () => ({
  getArticlesByFetchedAt: async () => [],
  enrichArticleContentBatch: async () => ({
    processed: 0,
    fetched: 0,
    failed: 0,
  }),
  enrichArticleTopicsBatch: async () => ({
    processed: 0,
    withTopics: 0,
  }),
}))

mock.module('@/lib/sanity/client', () => ({
  createSanityTokenWriteClientFromEnv: () => ({}),
  createSanityWriteClientFromEnv: () => ({
    client: {},
    schemaId: 'schema',
  }),
}))

mock.module('@/lib/sanity/sync', () => ({
  syncEditorialDrafts: async () => ({
    newsItemCount: 0,
    digestCount: 0,
    transformAttemptedCount: 0,
    transformSucceededCount: 0,
    transformFailedCount: 0,
    clusters: [],
  }),
}))

mock.module('@/lib/editorial/clustering', () => ({
  buildStoryClusters: async () => [],
}))

mock.module('@/lib/editorial/focus', () => ({
  isEditorialFocusMatch: () => true,
}))

mock.module('@/lib/editorial/congestion', () => ({
  defaultCongestionRules: {},
}))

describe('/api/cron/pull-articles', () => {
  const originalEnv = {
    CRON_SECRET: process.env.CRON_SECRET,
    EDITORIAL_PIPELINE_ENABLED: process.env.EDITORIAL_PIPELINE_ENABLED,
    EDITORIAL_SEMAPHOR_SYNC_ENABLED: process.env.EDITORIAL_SEMAPHOR_SYNC_ENABLED,
    PRIME_SYNC_ENABLED: process.env.PRIME_SYNC_ENABLED,
  }

  beforeEach(() => {
    resetState()
    process.env.CRON_SECRET = undefined
    process.env.EDITORIAL_PIPELINE_ENABLED = 'false'
    process.env.EDITORIAL_SEMAPHOR_SYNC_ENABLED = 'true'
    process.env.PRIME_SYNC_ENABLED = 'true'
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalEnv.CRON_SECRET
    process.env.EDITORIAL_PIPELINE_ENABLED = originalEnv.EDITORIAL_PIPELINE_ENABLED
    process.env.EDITORIAL_SEMAPHOR_SYNC_ENABLED = originalEnv.EDITORIAL_SEMAPHOR_SYNC_ENABLED
    process.env.PRIME_SYNC_ENABLED = originalEnv.PRIME_SYNC_ENABLED
    mock.restore()
  })

  it('returns 401 when cron secret does not match', async () => {
    const {GET} = await import('./route')
    process.env.CRON_SECRET = 'secret'

    const response = await GET(new Request('http://localhost:3000/api/cron/pull-articles'))
    expect(response.status).toBe(401)
  })

  it('returns segment statuses and partial_failed when warning segments exist', async () => {
    const {GET} = await import('./route')
    state.semaphorResult.failed = 1
    state.semaphorResult.errors = [
      {
        storyId: 's1',
        articleUrl: 'https://example.com/story',
        message: 'failed to sync',
      },
    ]
    state.moneyResult.status = 'partial_failed'
    state.moneyResult.warnings = ['macro context skipped']

    const response = await GET(new Request('http://localhost:3000/api/cron/pull-articles'))
    const payload = (await response.json()) as {
      overallStatus: 'succeeded' | 'partial_failed' | 'failed'
      segmentStatus: {
        ingestEditorial: 'succeeded' | 'partial_failed' | 'failed'
        semaphor: 'succeeded' | 'partial_failed' | 'failed'
        primeMetrics: 'succeeded' | 'partial_failed' | 'failed'
        moneySignals: 'succeeded' | 'partial_failed' | 'failed'
      }
    }

    expect(response.status).toBe(207)
    expect(payload.overallStatus).toBe('partial_failed')
    expect(payload.segmentStatus).toEqual({
      ingestEditorial: 'succeeded',
      semaphor: 'partial_failed',
      primeMetrics: 'succeeded',
      moneySignals: 'partial_failed',
      defenseGov: 'succeeded',
      samGov: 'succeeded',
    })
  })

  it('continues other segments when ingest/editorial fails', async () => {
    const {GET} = await import('./route')
    state.pullError = new Error('pull failed')

    const response = await GET(new Request('http://localhost:3000/api/cron/pull-articles'))
    const payload = (await response.json()) as {
      overallStatus: 'succeeded' | 'partial_failed' | 'failed'
      segmentStatus: {
        ingestEditorial: 'succeeded' | 'partial_failed' | 'failed'
        semaphor: 'succeeded' | 'partial_failed' | 'failed'
        primeMetrics: 'succeeded' | 'partial_failed' | 'failed'
        moneySignals: 'succeeded' | 'partial_failed' | 'failed'
      }
      semaphor: {status: 'succeeded' | 'partial_failed' | 'failed'}
      primeMetrics: {status: 'succeeded' | 'partial_failed' | 'failed'}
      moneySignals: {status: 'succeeded' | 'partial_failed' | 'failed'}
    }

    expect(response.status).toBe(207)
    expect(payload.overallStatus).toBe('partial_failed')
    expect(payload.segmentStatus.ingestEditorial).toBe('failed')
    expect(payload.semaphor.status).toBe('succeeded')
    expect(payload.primeMetrics.status).toBe('succeeded')
    expect(payload.moneySignals.status).toBe('succeeded')
  })
})
