import {describe, expect, it} from 'bun:test'

import {syncEditorialDrafts} from './sync'

import type {EditorialArticle, StoryCluster} from '@/lib/editorial/types'

function makeArticle(index: number, sourceIndex: number): EditorialArticle {
  return {
    id: `article-${index}`,
    title: `Cluster headline ${index}`,
    summary: `Summary sentence ${index}. Additional detail for context ${index}.`,
    fullTextExcerpt: null,
    articleUrl: `https://example.com/${index}`,
    sourceId: `source-${sourceIndex}`,
    sourceName: `Source ${sourceIndex}`,
    sourceCategory: 'journalism',
    sourceBadge: 'Analysis',
    publishedAt: '2026-02-13T12:00:00.000Z',
    fetchedAt: '2026-02-13T12:00:00.000Z',
    wordCount: 520,
    readingMinutes: 3,
    contentFetchStatus: 'fetched',
    topics: [
      {
        id: `topic-${sourceIndex}`,
        slug: `topic-${sourceIndex}`,
        label: `Topic ${sourceIndex}`,
        topicType: 'organization',
        isPrimary: index % 2 === 0,
      },
    ],
  }
}

function makeCluster(articleCount: number, sourceCount: number): StoryCluster {
  const members = Array.from({length: articleCount}, (_, index) => {
    const sourceIndex = index % sourceCount
    const article = makeArticle(index, sourceIndex)

    return {
      article,
      similarity: index === 0 ? 1 : 0.84,
      isRepresentative: index === 0,
    }
  })

  return {
    clusterKey: 'cluster-alpha-20260213',
    representativeArticle: members[0].article,
    topicLabel: 'Topic 0',
    members,
  }
}

function createMockSanityClient(options?: {
  transform?: (payload: unknown) => Promise<unknown>
}) {
  const docs = new Map<string, Record<string, unknown>>()
  const transformCalls: unknown[] = []

  const client = {
    createOrReplace: async (doc: Record<string, unknown>) => {
      docs.set(String(doc._id), {...doc})
      return doc
    },
    patch: (id: string) => {
      let patchValues: Record<string, unknown> = {}

      return {
        set(values: Record<string, unknown>) {
          patchValues = values
          return this
        },
        async commit() {
          const current = docs.get(id) ?? {_id: id}
          const next = {
            ...current,
            ...patchValues,
          }
          docs.set(id, next)
          return next
        },
      }
    },
    agent: {
      action: {
        transform: async (payload: unknown) => {
          transformCalls.push(payload)

          if (options?.transform) {
            return options.transform(payload)
          }

          return {ok: true}
        },
      },
    },
  }

  return {
    client,
    docs,
    transformCalls,
  }
}

describe('syncEditorialDrafts', () => {
  const now = new Date('2026-02-13T14:00:00.000Z')

  it('runs transform only when congestion trigger is met and targets storyDigest docs', async () => {
    const mock = createMockSanityClient()

    const result = await syncEditorialDrafts({
      client: mock.client as never,
      schemaId: 'schema-123',
      transformEnabled: true,
      now,
      clusters: [makeCluster(10, 6)],
    })

    expect(result.transformAttemptedCount).toBe(1)
    expect(result.transformSucceededCount).toBe(1)
    expect(result.transformFailedCount).toBe(0)
    expect(mock.transformCalls.length).toBe(1)

    const call = mock.transformCalls[0] as {documentId?: string}
    expect(call.documentId).toContain('drafts.storyDigest-')
  })

  it('does not run transform when below article threshold', async () => {
    const mock = createMockSanityClient()

    const result = await syncEditorialDrafts({
      client: mock.client as never,
      schemaId: 'schema-123',
      transformEnabled: true,
      now,
      clusters: [makeCluster(9, 6)],
    })

    expect(result.transformAttemptedCount).toBe(0)
    expect(mock.transformCalls.length).toBe(0)
  })

  it('does not run transform when source diversity threshold is not met', async () => {
    const mock = createMockSanityClient()

    const result = await syncEditorialDrafts({
      client: mock.client as never,
      schemaId: 'schema-123',
      transformEnabled: true,
      now,
      clusters: [makeCluster(12, 5)],
    })

    expect(result.transformAttemptedCount).toBe(0)
    expect(mock.transformCalls.length).toBe(0)
  })

  it('falls back to deterministic mode when transform fails', async () => {
    const mock = createMockSanityClient({
      transform: async () => {
        throw new Error('Transform unavailable')
      },
    })

    const result = await syncEditorialDrafts({
      client: mock.client as never,
      schemaId: 'schema-123',
      transformEnabled: true,
      now,
      clusters: [makeCluster(10, 6)],
    })

    expect(result.transformAttemptedCount).toBe(1)
    expect(result.transformSucceededCount).toBe(0)
    expect(result.transformFailedCount).toBe(1)
    expect(result.clusters[0]?.generationMode).toBe('deterministic')
    expect(result.clusters[0]?.transformStatus).toBe('failed')
  })

  it('writes draft docs with reviewStatus needs_review', async () => {
    const mock = createMockSanityClient()

    await syncEditorialDrafts({
      client: mock.client as never,
      schemaId: 'schema-123',
      transformEnabled: false,
      now,
      clusters: [makeCluster(10, 6)],
    })

    const digestEntries = [...mock.docs.entries()].filter(([id]) => id.startsWith('drafts.storyDigest-'))
    const newsEntries = [...mock.docs.entries()].filter(([id]) => id.startsWith('drafts.newsItem-'))

    expect(digestEntries.length).toBe(1)
    expect(newsEntries.length).toBe(10)
    expect(digestEntries[0]?.[1]?.reviewStatus).toBe('needs_review')
  })

  it('keeps source article payload immutable (one-way sync behavior)', async () => {
    const mock = createMockSanityClient()
    const cluster = makeCluster(10, 6)
    const before = JSON.stringify(cluster.members.map((member) => member.article))

    await syncEditorialDrafts({
      client: mock.client as never,
      schemaId: 'schema-123',
      transformEnabled: false,
      now,
      clusters: [cluster],
    })

    const after = JSON.stringify(cluster.members.map((member) => member.article))
    expect(after).toBe(before)
  })
})
