import {NextResponse} from 'next/server'

import {isDefenseMoneySignalsEnabled} from '@/lib/data/signals/config'
import {getSamGovPipelineData} from '@/lib/data/signals/sam-gov-server'

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

  const data = await getSamGovPipelineData({date})

  return NextResponse.json({
    data,
    meta: {
      date: date ?? null,
    },
  })
}
