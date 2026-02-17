import {NextResponse} from 'next/server'

import {getAwardTransactionHistory} from '@/lib/data/signals/usaspending-server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const awardId = url.searchParams.get('awardId')

  if (!awardId) {
    return NextResponse.json({error: 'awardId is required'}, {status: 400})
  }

  const data = await getAwardTransactionHistory(awardId)

  if (!data) {
    return NextResponse.json({error: 'Award not found'}, {status: 404})
  }

  return NextResponse.json({data})
}
