import {NextResponse} from 'next/server'

import {getCommentsForStory, createCommentForStory} from '@/lib/comments/server'
import {getAuthenticatedUser, getUserSession} from '@/lib/user/session'

type RouteContext = {
  params: Promise<{clusterKey: string}>
}

export async function GET(_request: Request, context: RouteContext) {
  const {clusterKey} = await context.params
  const session = await getUserSession()

  const comments = await getCommentsForStory(clusterKey, session.userId)

  return NextResponse.json({comments})
}

export async function POST(request: Request, context: RouteContext) {
  const {clusterKey} = await context.params
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const payload = await request.json().catch(() => null)
  const body = typeof payload?.body === 'string' ? payload.body : ''

  const result = await createCommentForStory({
    storyKey: clusterKey,
    userId: user.id,
    body,
  })

  if (result.error) {
    return NextResponse.json({error: result.error}, {status: 400})
  }

  return NextResponse.json({comment: result.comment})
}
