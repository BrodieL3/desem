import {describe, expect, it} from 'bun:test'

import {classifyEditorialFocus, isEditorialFocusMatch} from './focus'

describe('classifyEditorialFocus', () => {
  it('marks international event stories as focus', () => {
    const bucket = classifyEditorialFocus({
      title: 'NATO allies coordinate new air defense package for Ukraine',
      summary: 'Officials discussed support across Europe and the Black Sea region.',
    })

    expect(bucket).toBe('international')
    expect(
      isEditorialFocusMatch({
        title: 'NATO allies coordinate new air defense package for Ukraine',
      })
    ).toBe(true)
  })

  it('marks U.S. defense company stories as focus', () => {
    const bucket = classifyEditorialFocus({
      title: 'Lockheed Martin wins missile interceptor production lot',
      summary: 'The contract award expands U.S. manufacturing throughput.',
    })

    expect(bucket).toBe('us-defense-company')
  })

  it('returns other for unrelated domestic stories', () => {
    const bucket = classifyEditorialFocus({
      title: 'Pentagon cafeteria menu update for spring season',
      summary: 'New food vendors arrive next month.',
    })

    expect(bucket).toBe('other')
  })
})
