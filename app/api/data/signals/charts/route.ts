import {NextResponse} from 'next/server'

import {getDefenseMoneyChartsData, isDefenseMoneySignalsEnabled} from '@/lib/data/signals/charts-server'

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function GET(request: Request) {
  if (!isDefenseMoneySignalsEnabled()) {
    return NextResponse.json(
      {
        error: 'Defense money signals module is disabled.',
      },
      {status: 503}
    )
  }

  const url = new URL(request.url)
  const requestedDate = url.searchParams.get('date')
  const date = requestedDate && isIsoDate(requestedDate) ? requestedDate : undefined

  const data = await getDefenseMoneyChartsData({date})

  return NextResponse.json({
    data,
    meta: {
      date: date ?? null,
      stale: data.staleData,
    },
  })
}
