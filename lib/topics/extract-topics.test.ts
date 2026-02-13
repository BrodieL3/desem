import {describe, expect, it} from 'bun:test'

import {extractTopicsFromArticle} from './extract-topics'

describe('extractTopicsFromArticle', () => {
  it('identifies canonical Department of Defense and SBIR topics', () => {
    const topics = extractTopicsFromArticle({
      title: 'DoD expands SBIR solicitation for autonomous maritime platforms',
      summary:
        'The Department of Defense announced a new SBIR call focused on autonomy, sensor fusion, and resilient comms.',
      fullText:
        'The U.S. Department of Defense said SBIR funding will support prototype transitions in FY26. DoD officials said the SBIR program is central to adoption timelines.',
    })

    const labels = new Set(topics.map((topic) => topic.label))

    expect(labels.has('Department of Defense')).toBe(true)
    expect(labels.has('Small Business Innovation Research')).toBe(true)
  })
})
