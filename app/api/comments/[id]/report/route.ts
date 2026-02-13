import {NextResponse} from 'next/server'

import {reportComment} from '@/lib/comments/server'
import {getAuthenticatedUser} from '@/lib/user/session'

type RouteContext = {
  params: Promise<{id: string}>
}

export async function POST(request: Request, context: RouteContext) {
  const {id} = await context.params
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const payload = await request.json().catch(() => null)
  const reason = typeof payload?.reason === 'string' ? payload.reason : ''

  const result = await reportComment({
    commentId: id,
    reporterUserId: user.id,
    reason,
  })

  if (!result.ok) {
    return NextResponse.json({error: result.error}, {status: result.duplicate ? 409 : 400})
  }

  return NextResponse.json({ok: true})
}
