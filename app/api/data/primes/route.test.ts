import {describe, expect, it} from 'bun:test'

import {GET} from './route'

describe('/api/data/primes', () => {
  it('returns 503 when module is disabled', async () => {
    const original = process.env.DATA_PRIMES_ENABLED
    process.env.DATA_PRIMES_ENABLED = 'false'

    try {
      const response = await GET(new Request('http://localhost:3000/api/data/primes'))
      const payload = (await response.json()) as {error?: string}

      expect(response.status).toBe(503)
      expect(payload.error).toContain('disabled')
    } finally {
      process.env.DATA_PRIMES_ENABLED = original
    }
  })

  it('returns dashboard payload when module is enabled', async () => {
    const original = process.env.DATA_PRIMES_ENABLED
    process.env.DATA_PRIMES_ENABLED = 'true'

    try {
      const response = await GET(new Request('http://localhost:3000/api/data/primes?windowQuarters=20'))
      const payload = (await response.json()) as {
        data?: {windowQuarters?: number; companies?: Array<{ticker: string}>}
        meta?: {windowQuarters?: number}
      }

      expect(response.status).toBe(200)
      expect(payload.data?.windowQuarters).toBe(20)
      expect(payload.meta?.windowQuarters).toBe(20)
      expect(payload.data?.companies?.some((company) => company.ticker === 'LHX')).toBe(true)
    } finally {
      process.env.DATA_PRIMES_ENABLED = original
    }
  })
})
