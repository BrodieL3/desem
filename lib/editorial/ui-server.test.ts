import {describe, expect, it} from 'bun:test'

import {buildHomeStoryStream, mapStoryTopicsForDetail, paginateEvidenceBlocks} from './ui-server'

import type {CuratedStoryCard, EvidenceBlock} from './ui-types'
import type {EditorialFocusBucket} from './focus'

function makeCard(input: {
  key: string
  topic: string
  score: number
  focusBucket?: EditorialFocusBucket
  publishedAt?: string
  sourceName?: string
  opinionOnly?: boolean
}): CuratedStoryCard & {topicLabel: string; focusBucket: EditorialFocusBucket} {
  const opinionOnly = Boolean(input.opinionOnly)

  return {
    clusterKey: input.key,
    headline: `Headline ${input.key}`,
    dek: `Dek ${input.key}`,
    whyItMatters: `Why ${input.key}`,
    riskLevel: 'medium',
    citationCount: 3,
    generationMode: 'deterministic',
    reviewStatus: 'published',
    isCongestedCluster: false,
    publishedAt: input.publishedAt ?? '2026-02-13T12:00:00.000Z',
    sourceName: input.sourceName ?? 'Source',
    sourceLinks: [],
    hasOfficialSource: false,
    reportingCount: opinionOnly ? 0 : 2,
    analysisCount: opinionOnly ? 0 : 1,
    officialCount: 0,
    opinionCount: opinionOnly ? 2 : 0,
    pressReleaseDriven: false,
    opinionLimited: opinionOnly,
    sourceDiversity: 3,
    score: input.score,
    topicLabel: input.topic,
    focusBucket: input.focusBucket ?? 'international',
  }
}

function makeEvidence(count: number): EvidenceBlock[] {
  return Array.from({length: count}, (_, index) => ({
    id: `e-${index}`,
    articleId: `a-${index}`,
    sourceName: 'Source',
    headline: `Headline ${index}`,
    excerpt: `Excerpt ${index}`,
    publishedAt: '2026-02-13T12:00:00.000Z',
    articleUrl: `https://example.com/${index}`,
    sourceBadge: 'Analysis',
  }))
}

describe('buildHomeStoryStream', () => {
  it('keeps a flat stream and prioritizes focus-matching stories', () => {
    const cards = [
      makeCard({key: '1', topic: 'General', score: 700, focusBucket: 'other'}),
      makeCard({key: '2', topic: 'Ukraine', score: 650, focusBucket: 'international'}),
      makeCard({key: '3', topic: 'Lockheed Martin', score: 630, focusBucket: 'us-defense-company'}),
      makeCard({key: '4', topic: 'General', score: 620, focusBucket: 'other'}),
    ]

    const stream = buildHomeStoryStream(cards, {limit: 12})

    expect(stream.length).toBe(2)
    expect(stream[0]?.clusterKey).toBe('2')
    expect(stream[1]?.clusterKey).toBe('3')
  })

  it('returns an empty stream when no focus matches exist', () => {
    const cards = [
      makeCard({key: '1', topic: 'Topic A', score: 110, focusBucket: 'other'}),
      makeCard({key: '2', topic: 'Topic B', score: 420, focusBucket: 'other'}),
      makeCard({key: '3', topic: 'Topic C', score: 300, focusBucket: 'other'}),
    ]

    const stream = buildHomeStoryStream(cards, {limit: 3})

    expect(stream.length).toBe(0)
  })

  it('caps how many homepage stories come from the same source', () => {
    const cards = [
      makeCard({key: '1', topic: 'A', score: 700, sourceName: 'Source A'}),
      makeCard({key: '2', topic: 'A', score: 690, sourceName: 'Source A'}),
      makeCard({key: '3', topic: 'A', score: 680, sourceName: 'Source A'}),
      makeCard({key: '4', topic: 'A', score: 670, sourceName: 'Source A'}),
      makeCard({key: '5', topic: 'B', score: 660, sourceName: 'Source B'}),
      makeCard({key: '6', topic: 'C', score: 650, sourceName: 'Source C'}),
    ]

    const stream = buildHomeStoryStream(cards, {limit: 6})
    const sourceACount = stream.filter((card) => card.sourceName === 'Source A').length

    expect(sourceACount).toBe(3)
    expect(stream.length).toBe(5)
  })

  it('limits opinion-only stories in the homepage stream', () => {
    const cards = [
      makeCard({key: '1', topic: 'A', score: 700, sourceName: 'Opinion 1', opinionOnly: true}),
      makeCard({key: '2', topic: 'A', score: 690, sourceName: 'Opinion 2', opinionOnly: true}),
      makeCard({key: '3', topic: 'A', score: 680, sourceName: 'Opinion 3', opinionOnly: true}),
      makeCard({key: '4', topic: 'B', score: 640, sourceName: 'Reporter 1'}),
      makeCard({key: '5', topic: 'C', score: 630, sourceName: 'Reporter 2'}),
      makeCard({key: '6', topic: 'D', score: 620, sourceName: 'Reporter 3'}),
    ]

    const stream = buildHomeStoryStream(cards, {limit: 6})
    const opinionCount = stream.filter((card) => card.opinionCount > 0 && card.reportingCount === 0).length

    expect(opinionCount).toBe(2)
  })
})

describe('paginateEvidenceBlocks', () => {
  it('returns first page and indicates hasMore', () => {
    const paged = paginateEvidenceBlocks(makeEvidence(11), 0, 8)

    expect(paged.slice.length).toBe(8)
    expect(paged.total).toBe(11)
    expect(paged.hasMore).toBe(true)
  })

  it('returns second page and disables hasMore at end', () => {
    const paged = paginateEvidenceBlocks(makeEvidence(11), 8, 8)

    expect(paged.slice.length).toBe(3)
    expect(paged.offset).toBe(8)
    expect(paged.hasMore).toBe(false)
  })

  it('normalizes non-multiple batch sizes down to 8-step increments', () => {
    const paged = paginateEvidenceBlocks(makeEvidence(20), 0, 10)

    expect(paged.limit).toBe(8)
    expect(paged.slice.length).toBe(8)
  })
})

describe('mapStoryTopicsForDetail', () => {
  it('filters low-value/non-canonical topics and only keeps canonical story topics', () => {
    const topics = mapStoryTopicsForDetail({
      topicRows: [
        {articleId: 'a1', id: 'monday', slug: 'monday', label: 'Monday'},
        {articleId: 'a2', id: 'monday', slug: 'monday', label: 'Monday'},
        {
          articleId: 'a1',
          id: 'dod',
          slug: 'department-of-defense',
          label: 'Department of Defense',
        },
        {
          articleId: 'a1',
          id: 'non-tax-single',
          slug: 'operation-trident-shield',
          label: 'Operation Trident Shield',
        },
        {
          articleId: 'a1',
          id: 'followed-single',
          slug: 'task-force-ember',
          label: 'Task Force Ember',
        },
        {
          articleId: 'a2',
          id: 'iran',
          slug: 'iran',
          label: 'Iran',
        },
      ],
      followedTopicIds: new Set(['dod', 'followed-single']),
      limit: 8,
    })

    const ids = new Set(topics.map((topic) => topic.id))

    expect(ids.has('monday')).toBe(false)
    expect(ids.has('dod')).toBe(true)
    expect(topics.find((topic) => topic.id === 'dod')?.followed).toBe(true)
    expect(ids.has('non-tax-single')).toBe(false)
    expect(ids.has('followed-single')).toBe(false)
    expect(ids.has('iran')).toBe(true)
  })
})
