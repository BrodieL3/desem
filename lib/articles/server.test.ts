import {describe, expect, it} from 'bun:test'

import {buildCooccurringTopicSummaries, buildTrendingTopics} from './server'
import type {ArticleCard, ArticleTopic} from './types'

function makeTopic(input: Partial<ArticleTopic> & Pick<ArticleTopic, 'id' | 'slug' | 'label'>): ArticleTopic {
  return {
    id: input.id,
    slug: input.slug,
    label: input.label,
    topicType: input.topicType ?? 'organization',
    confidence: input.confidence ?? 0.74,
    occurrences: input.occurrences ?? 2,
    isPrimary: input.isPrimary ?? true,
  }
}

function makeArticle(id: string, topics: ArticleTopic[]): ArticleCard {
  return {
    id,
    title: `Title ${id}`,
    summary: 'Summary',
    fullTextExcerpt: 'Excerpt',
    articleUrl: `https://example.com/${id}`,
    sourceId: 'source',
    sourceName: 'Source',
    sourceBadge: 'Reporting',
    sourceWeight: 1,
    publishedAt: '2026-02-13T12:00:00.000Z',
    fetchedAt: '2026-02-13T12:00:00.000Z',
    leadImageUrl: null,
    canonicalImageUrl: null,
    wordCount: 500,
    readingMinutes: 3,
    contentFetchStatus: 'fetched',
    commentCount: 0,
    topics,
    personalizationScore: 0,
  }
}

describe('buildTrendingTopics', () => {
  it('filters low-value labels and all non-canonical topics', () => {
    const monday = makeTopic({id: 'monday', slug: 'monday', label: 'Monday'})
    const novelOnce = makeTopic({id: 'novel', slug: 'operation-trident-shield', label: 'Operation Trident Shield'})
    const canonical = makeTopic({
      id: 'dod',
      slug: 'department-of-defense',
      label: 'Department of Defense',
    })

    const topics = buildTrendingTopics(
      [
        makeArticle('a1', [monday, canonical]),
        makeArticle('a2', [monday]),
        makeArticle('a3', [novelOnce]),
      ],
      new Set<string>(),
      10
    )

    const labels = new Set(topics.map((topic) => topic.label))
    expect(labels.has('Monday')).toBe(false)
    expect(labels.has('Operation Trident Shield')).toBe(false)
    expect(labels.has('Department of Defense')).toBe(true)
  })

  it('does not keep followed non-canonical topics visible', () => {
    const followed = makeTopic({
      id: 'followed-topic',
      slug: 'operation-trident-shield',
      label: 'Operation Trident Shield',
    })

    const topics = buildTrendingTopics([makeArticle('a1', [followed])], new Set(['followed-topic']), 10)

    expect(topics.some((topic) => topic.id === 'followed-topic')).toBe(false)
  })
})

describe('buildCooccurringTopicSummaries', () => {
  it('applies canonical-only eligibility to co-occurring topics', () => {
    const topics = buildCooccurringTopicSummaries(
      [
        {
          id: 'low-value',
          slug: 'monday',
          label: 'Monday',
          topicType: 'organization',
          followed: false,
        },
        {
          id: 'single-non-tax',
          slug: 'operation-trident-shield',
          label: 'Operation Trident Shield',
          topicType: 'program',
          followed: false,
        },
        {
          id: 'followed-single',
          slug: 'task-force-ember',
          label: 'Task Force Ember',
          topicType: 'organization',
          followed: true,
        },
        {
          id: 'canonical',
          slug: 'department-of-defense',
          label: 'Department of Defense',
          topicType: 'organization',
          followed: false,
        },
      ],
      10
    )

    const ids = new Set(topics.map((topic) => topic.id))
    expect(ids.has('low-value')).toBe(false)
    expect(ids.has('single-non-tax')).toBe(false)
    expect(ids.has('followed-single')).toBe(false)
    expect(ids.has('canonical')).toBe(true)
  })
})
