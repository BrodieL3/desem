import {describe, expect, it, mock} from 'bun:test'

import {fetchUsaspendingTransactions} from './usaspending'

describe('fetchUsaspendingTransactions', () => {
  it('posts expected payload and returns filtered normalized rows', async () => {
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              'Action Date': '2026-02-14',
              'Award ID': 'X-1',
              'Recipient Name': 'Recipient A',
              'Awarding Agency': 'Department of Defense',
              'Transaction Amount': 12000000,
              'Transaction Description': 'Counter-UAS kit procurement',
              naics_code: '332993',
              product_or_service_code: '1395',
              generated_internal_id: 'CONT_AWD_X_9700',
            },
            {
              'Action Date': '2026-02-14',
              'Award ID': 'X-2',
              'Recipient Name': 'Recipient B',
              'Awarding Agency': 'Department of Defense',
              'Transaction Amount': 1000,
              generated_internal_id: 'CONT_AWD_Y_9700',
            },
          ],
          page_metadata: {
            hasNext: false,
          },
          messages: ['warning-1'],
        })
      )
    )

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock

    try {
      const result = await fetchUsaspendingTransactions({
        apiBaseUrl: 'https://api.usaspending.gov',
        actionDate: '2026-02-14',
        awardingAgencies: ['Department of Defense'],
        minTransactionUsd: 10_000_000,
        maxPages: 5,
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result.warnings).toContain('warning-1')
      expect(result.transactions.length).toBe(1)
      expect(result.transactions[0]?.generatedInternalId).toBe('CONT_AWD_X_9700')
      expect(result.transactions[0]?.sourceUrl).toContain('/api/v2/awards/CONT_AWD_X_9700/')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
