import {NextResponse} from 'next/server'

import {getAwardMatrixData} from '@/lib/data/signals/usaspending-server'

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const rawStart = url.searchParams.get('startDate')
  const rawEnd = url.searchParams.get('endDate')

  const startDate = rawStart && isIsoDate(rawStart) ? rawStart : undefined
  const endDate = rawEnd && isIsoDate(rawEnd) ? rawEnd : undefined

  const data = await getAwardMatrixData({startDate, endDate})

  return NextResponse.json({data})
}
