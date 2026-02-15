import {describe, expect, it} from 'bun:test'

import {generateGuardrailedImplication} from './implications'

describe('generateGuardrailedImplication', () => {
  it('returns deterministic fallback when llm is disabled', async () => {
    const result = await generateGuardrailedImplication({
      headline: 'New Money',
      summary: 'Large counter-UAS awards concentrated in one recipient.',
      deterministicSoWhat: 'Prioritize capture in counter-UAS adjacent work.',
      citations: [
        {
          id: 'c1',
          label: 'Source citation',
          url: 'https://example.com',
        },
      ],
      model: 'gpt-4.1-mini',
      llmEnabled: false,
    })

    expect(result.generatedMode).toBe('deterministic')
    expect(result.soWhat).toContain('Prioritize capture')
  })

  it('falls back when llm is enabled but api key is missing', async () => {
    const original = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    try {
      const result = await generateGuardrailedImplication({
        headline: 'Prime Moves',
        summary: 'RTX +2.4% after sustainment task order.',
        deterministicSoWhat: 'Tune messaging to sustainment urgency.',
        citations: [
          {
            id: 'c1',
            label: 'Source citation',
            url: 'https://example.com',
          },
        ],
        model: 'gpt-4.1-mini',
        llmEnabled: true,
      })

      expect(result.generatedMode).toBe('deterministic')
    } finally {
      process.env.OPENAI_API_KEY = original
    }
  })
})
