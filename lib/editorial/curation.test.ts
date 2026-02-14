import {describe, expect, it} from 'bun:test'

import {buildCuratedCitations} from './curation'

import type {StoryCluster} from './types'

function makeCluster(input: {
  key: string
  members: Array<{
    id: string
    title: string
    sourceId: string
    sourceName: string
    sourceCategory: string
    sourceBadge: string
    isRepresentative?: boolean
  }>
}): StoryCluster {
  const members = input.members.map((member, index) => ({
    isRepresentative: Boolean(member.isRepresentative),
    similarity: index === 0 ? 1 : 0.84,
    article: {
      id: member.id,
      title: member.title,
      summary: `${member.title} summary.`,
      fullTextExcerpt: null,
      articleUrl: `https://example.com/${member.id}`,
      sourceId: member.sourceId,
      sourceName: member.sourceName,
      sourceCategory: member.sourceCategory,
      sourceBadge: member.sourceBadge,
      publishedAt: '2026-02-13T12:00:00.000Z',
      fetchedAt: '2026-02-13T12:00:00.000Z',
      wordCount: 320,
      readingMinutes: 2,
      contentFetchStatus: 'fetched',
      topics: [],
    },
  }))

  const representative = members.find((member) => member.isRepresentative)?.article ?? members[0].article

  return {
    clusterKey: input.key,
    representativeArticle: representative,
    topicLabel: 'Procurement',
    members,
  }
}

describe('buildCuratedCitations', () => {
  it('keeps an official source when a story is press-release-driven', () => {
    const cluster = makeCluster({
      key: 'cluster-release',
      members: [
        {
          id: 'a1',
          title: 'DoD awards missile defense contract for next phase',
          sourceId: 'dod-releases',
          sourceName: 'U.S. Department of Defense Releases',
          sourceCategory: 'official',
          sourceBadge: 'DoD release',
          isRepresentative: true,
        },
        {
          id: 'a2',
          title: 'Defense News tracks details from latest missile award',
          sourceId: 'defense-news',
          sourceName: 'Defense News',
          sourceCategory: 'journalism',
          sourceBadge: 'Reporting',
        },
        {
          id: 'a3',
          title: 'Breaking Defense reviews program impacts',
          sourceId: 'breaking-defense',
          sourceName: 'Breaking Defense',
          sourceCategory: 'journalism',
          sourceBadge: 'Reporting',
        },
      ],
    })

    const curated = buildCuratedCitations(cluster, {maxCitations: 6})

    expect(curated.summary.pressReleaseDriven).toBe(true)
    expect(curated.summary.hasOfficialSource).toBe(true)
    expect(curated.citations.some((citation) => citation.sourceRole === 'official')).toBe(true)
  })

  it('limits opinion citations to at most one', () => {
    const cluster = makeCluster({
      key: 'cluster-opinion',
      members: [
        {
          id: 'b1',
          title: 'Opinion: Why this modernization bet is flawed',
          sourceId: 'real-clear-defense',
          sourceName: 'RealClearDefense',
          sourceCategory: 'analysis',
          sourceBadge: 'Opinion',
          isRepresentative: true,
        },
        {
          id: 'b2',
          title: 'Opinion: A second take on modernization',
          sourceId: 'real-clear-defense',
          sourceName: 'RealClearDefense',
          sourceCategory: 'analysis',
          sourceBadge: 'Opinion',
        },
        {
          id: 'b3',
          title: 'Defense One reports procurement timeline',
          sourceId: 'defense-one',
          sourceName: 'Defense One',
          sourceCategory: 'journalism',
          sourceBadge: 'Reporting',
        },
      ],
    })

    const curated = buildCuratedCitations(cluster, {maxCitations: 6})
    const opinionCount = curated.citations.filter((citation) => citation.sourceRole === 'opinion').length

    expect(opinionCount).toBe(1)
    expect(curated.summary.opinionLimited).toBe(true)
  })
})
