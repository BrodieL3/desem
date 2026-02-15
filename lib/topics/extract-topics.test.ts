import {describe, expect, it} from 'bun:test'

import {extractTopicsFromArticle} from './extract-topics'

describe('extractTopicsFromArticle', () => {
  it('rejects low-value dateline/calendar fragments and explicit stopword labels', () => {
    const topics = extractTopicsFromArticle({
      title: 'LONDON — MONDAY, JANUARY 15, 2026: Read More',
      summary: 'Updated at 08:00. Live updates from the desk.',
      fullText:
        'Added 14 January 2026\nUpdated 15 January 2026\nNATO officials met in Brussels to review force posture and regional readiness.',
      sourceId: 'uk-mod',
      sourceName: 'UK Ministry of Defence',
      sourceCategory: 'official',
    })

    const labels = new Set(topics.map((topic) => topic.label.toLowerCase()))

    expect(labels.has('london')).toBe(false)
    expect(labels.has('monday')).toBe(false)
    expect(labels.has('january')).toBe(false)
    expect(labels.has('read more')).toBe(false)
    expect(labels.has('and')).toBe(false)
    expect(labels.has('but')).toBe(false)
    expect(labels.has('for')).toBe(false)
    expect(labels.has('north atlantic treaty organization')).toBe(true)
  })

  it('normalizes DoD aliases to canonical Department of Defense', () => {
    const topics = extractTopicsFromArticle({
      title: 'DOD and D.o.D. brief on next procurement cycle',
      summary:
        'Department of War references were used in older doctrine, while DoD officials described the current policy.',
      fullText:
        'The U.S. Department of Defense said the policy remains active and DoD guidance is unchanged.',
    })

    const labels = new Set(topics.map((topic) => topic.label))
    const dodTopics = topics.filter((topic) => topic.label === 'Department of Defense')

    expect(labels.has('Department of Defense')).toBe(true)
    expect(dodTopics.length).toBe(1)
    expect(topics.every((topic) => topic.matchedBy === 'taxonomy')).toBe(true)
  })

  it('maps DOW alias only in defense context', () => {
    const defenseTopics = extractTopicsFromArticle({
      title: 'DOW memo informs new missile procurement',
      summary: 'Pentagon officials tied the update to force modernization.',
    })
    const nonDefenseTopics = extractTopicsFromArticle({
      title: 'Dow closes higher as markets rebound',
      summary: 'Analysts cited improving retail earnings and broad market momentum.',
      sourceName: 'Market Wire',
      sourceCategory: 'analysis',
    })

    const defenseLabels = new Set(defenseTopics.map((topic) => topic.label))
    const nonDefenseLabels = new Set(nonDefenseTopics.map((topic) => topic.label))

    expect(defenseLabels.has('Department of Defense')).toBe(true)
    expect(nonDefenseLabels.has('Department of Defense')).toBe(false)
  })

  it('extracts requested canonical defense/geopolitical topics', () => {
    const topics = extractTopicsFromArticle({
      title: 'DARPA and U.S. Army review deterrence implications for Iran, China, and Russia',
      summary: 'Officials discussed new capability priorities.',
    })

    const labels = new Set(topics.map((topic) => topic.label))

    expect(labels.has('Defense Advanced Research Projects Agency')).toBe(true)
    expect(labels.has('U.S. Army')).toBe(true)
    expect(labels.has('Iran')).toBe(true)
    expect(labels.has('China')).toBe(true)
    expect(labels.has('Russia')).toBe(true)
  })
})
