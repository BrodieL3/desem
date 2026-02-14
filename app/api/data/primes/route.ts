import {NextResponse} from 'next/server'

import {getPrimeDashboardData, isPrimeDataEnabled} from '@/lib/data/primes/server'

function parseIntParam(value: string | null, fallback: number, min: number, max: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(min, Math.min(max, parsed))
}

export async function GET(request: Request) {
  if (!isPrimeDataEnabled()) {
    return NextResponse.json(
      {
        error: 'Prime metrics module is disabled.',
      },
      {status: 503}
    )
  }

  const url = new URL(request.url)
  const windowQuarters = parseIntParam(url.searchParams.get('windowQuarters'), 20, 4, 24)

  const data = await getPrimeDashboardData({windowQuarters})

  return NextResponse.json({
    data,
    meta: {
      countRows: data.tableRows.length,
      windowQuarters: data.windowQuarters,
    },
  })
}
