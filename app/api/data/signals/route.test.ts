import {describe, expect, it} from 'bun:test'

import {GET} from './route'

describe('/api/data/signals', () => {
  it('returns 503 when module is disabled', async () => {
    const original = process.env.DATA_MONEY_SIGNALS_ENABLED
    process.env.DATA_MONEY_SIGNALS_ENABLED = 'false'

    try {
      const response = await GET(new Request('http://localhost:3000/api/data/signals'))
      const payload = (await response.json()) as {error?: string}

      expect(response.status).toBe(503)
      expect(payload.error).toContain('disabled')
    } finally {
      process.env.DATA_MONEY_SIGNALS_ENABLED = original
    }
  })

  it('returns signal payload when module is enabled', async () => {
    const original = process.env.DATA_MONEY_SIGNALS_ENABLED
    process.env.DATA_MONEY_SIGNALS_ENABLED = 'true'

    try {
      const response = await GET(new Request('http://localhost:3000/api/data/signals?date=2026-02-13'))
      const payload = (await response.json()) as {
        data?: {
          staleData?: {
            daily?: boolean
          }
        }
      }

      expect(response.status).toBe(200)
      expect(typeof payload.data?.staleData?.daily).toBe('boolean')
    } finally {
      process.env.DATA_MONEY_SIGNALS_ENABLED = original
    }
  })
})
