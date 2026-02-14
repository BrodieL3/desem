import {afterEach, beforeEach, describe, expect, it} from 'bun:test'

import {__resetSightengineCacheForTests, getImageDisplayAssessment, shouldDisplayNonAiImageUrl} from './sightengine'

const originalFetch = global.fetch
const originalApiKey = process.env.NEXT_PUBLIC_SIGHTENGINE_API_KEY
const originalApiSecret = process.env.NEXT_PUBLIC_SIGHTENGINE_API_SECRET
const originalThreshold = process.env.SIGHTENGINE_AI_GENERATED_THRESHOLD
const originalQualityThreshold = process.env.SIGHTENGINE_IMAGE_QUALITY_THRESHOLD

describe('shouldDisplayNonAiImageUrl', () => {
  beforeEach(() => {
    __resetSightengineCacheForTests()
    process.env.NEXT_PUBLIC_SIGHTENGINE_API_KEY = 'test-api-user'
    process.env.NEXT_PUBLIC_SIGHTENGINE_API_SECRET = 'test-api-secret'
    delete process.env.SIGHTENGINE_AI_GENERATED_THRESHOLD
    delete process.env.SIGHTENGINE_IMAGE_QUALITY_THRESHOLD
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.NEXT_PUBLIC_SIGHTENGINE_API_KEY = originalApiKey
    process.env.NEXT_PUBLIC_SIGHTENGINE_API_SECRET = originalApiSecret
    process.env.SIGHTENGINE_AI_GENERATED_THRESHOLD = originalThreshold
    process.env.SIGHTENGINE_IMAGE_QUALITY_THRESHOLD = originalQualityThreshold
    __resetSightengineCacheForTests()
  })

  it('returns true when Sightengine reports a low AI-generated score', async () => {
    global.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: 'success',
          type: {
            ai_generated: 0.08,
          },
          quality: {
            score: 0.91,
          },
        }),
        {status: 200}
      )
    }) as typeof fetch

    const result = await shouldDisplayNonAiImageUrl('https://example.com/real-photo.jpg')

    expect(result).toBe(true)
  })

  it('returns false when Sightengine reports a high AI-generated score', async () => {
    global.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: 'success',
          type: {
            ai_generated: 0.91,
          },
          quality: {
            score: 0.88,
          },
        }),
        {status: 200}
      )
    }) as typeof fetch

    const result = await shouldDisplayNonAiImageUrl('https://example.com/ai-image.jpg')

    expect(result).toBe(false)
  })

  it('respects custom threshold values from env', async () => {
    process.env.SIGHTENGINE_AI_GENERATED_THRESHOLD = '0.2'

    global.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: 'success',
          type: {
            ai_generated: 0.25,
          },
          quality: {
            score: 0.92,
          },
        }),
        {status: 200}
      )
    }) as typeof fetch

    const result = await shouldDisplayNonAiImageUrl('https://example.com/uncertain-image.jpg')

    expect(result).toBe(false)
  })

  it('deduplicates in-flight checks for the same URL', async () => {
    let fetchCallCount = 0

    global.fetch = (async () => {
      fetchCallCount += 1

      return new Response(
        JSON.stringify({
          status: 'success',
          type: {
            ai_generated: 0.04,
          },
          quality: {
            score: 0.84,
          },
        }),
        {status: 200}
      )
    }) as typeof fetch

    const [first, second] = await Promise.all([
      shouldDisplayNonAiImageUrl('https://example.com/same-image.jpg'),
      shouldDisplayNonAiImageUrl('https://example.com/same-image.jpg'),
    ])

    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(fetchCallCount).toBe(1)
  })

  it('fails closed when credentials are missing', async () => {
    delete process.env.NEXT_PUBLIC_SIGHTENGINE_API_KEY
    delete process.env.NEXT_PUBLIC_SIGHTENGINE_API_SECRET

    const result = await shouldDisplayNonAiImageUrl('https://example.com/no-credentials.jpg')

    expect(result).toBe(false)
  })

  it('returns false when quality score is below threshold', async () => {
    global.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: 'success',
          type: {
            ai_generated: 0.05,
          },
          quality: {
            score: 0.2,
          },
        }),
        {status: 200}
      )
    }) as typeof fetch

    const result = await shouldDisplayNonAiImageUrl('https://example.com/low-quality.jpg')
    expect(result).toBe(false)
  })

  it('adds low_relevance reason when relevance score is weak', async () => {
    global.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: 'success',
          type: {
            ai_generated: 0.05,
          },
          quality: {
            score: 0.95,
          },
        }),
        {status: 200}
      )
    }) as typeof fetch

    const result = await getImageDisplayAssessment({
      imageUrl: 'https://example.com/relevance.jpg',
      relevanceScore: 0.1,
    })

    expect(result.shouldDisplay).toBe(false)
    expect(result.reasons.includes('low_relevance')).toBe(true)
  })
})
