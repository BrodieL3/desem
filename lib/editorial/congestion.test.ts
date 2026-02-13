import {describe, expect, it} from 'bun:test'

import {evaluateClusterCongestion} from './congestion'
import type {StoryCluster} from './types'

function makeCluster(articleCount: number, sourceCount: number): StoryCluster {
  const members = Array.from({length: articleCount}, (_, index) => {
    const sourceIndex = index % sourceCount

    return {
      similarity: 1,
      isRepresentative: index === 0,
      article: {
        id: `article-${index}`,
        title: `Story ${index}`,
        summary: `Summary ${index}`,
        fullTextExcerpt: null,
        articleUrl: `https://example.com/${index}`,
        sourceId: `source-${sourceIndex}`,
        sourceName: `Source ${sourceIndex}`,
        sourceBadge: 'Analysis',
        publishedAt: '2026-02-13T12:00:00.000Z',
        fetchedAt: '2026-02-13T12:00:00.000Z',
        wordCount: 420,
        readingMinutes: 2,
        contentFetchStatus: 'fetched',
        topics: [],
      },
    }
  })

  return {
    clusterKey: 'cluster-alpha',
    representativeArticle: members[0].article,
    topicLabel: null,
    members,
  }
}

describe('evaluateClusterCongestion', () => {
  const now = new Date('2026-02-13T14:00:00.000Z')

  it('does not mark 9 articles / 6 sources as congested', () => {
    const result = evaluateClusterCongestion(makeCluster(9, 6), {now})

    expect(result.articleCount24h).toBe(9)
    expect(result.uniqueSources24h).toBe(6)
    expect(result.isCongested).toBe(false)
  })

  it('marks 10 articles / 6 sources as congested', () => {
    const result = evaluateClusterCongestion(makeCluster(10, 6), {now})

    expect(result.articleCount24h).toBe(10)
    expect(result.uniqueSources24h).toBe(6)
    expect(result.isCongested).toBe(true)
  })

  it('does not mark 12 articles / 5 sources as congested', () => {
    const result = evaluateClusterCongestion(makeCluster(12, 5), {now})

    expect(result.articleCount24h).toBe(12)
    expect(result.uniqueSources24h).toBe(5)
    expect(result.isCongested).toBe(false)
  })
})
