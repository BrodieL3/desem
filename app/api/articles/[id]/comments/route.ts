import {NextResponse} from 'next/server'

import {createCommentForArticle, getCommentsForArticle} from '@/lib/comments/server'
import {getAuthenticatedUser} from '@/lib/user/session'

type RouteContext = {
  params: Promise<{id: string}>
}

export async function GET(_request: Request, context: RouteContext) {
  const {id} = await context.params
  const user = await getAuthenticatedUser()

  const comments = await getCommentsForArticle(id, user?.id ?? null)

  return NextResponse.json({
    data: comments,
    meta: {
      count: comments.length,
    },
  })
}

export async function POST(request: Request, context: RouteContext) {
  const {id} = await context.params
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const payload = await request.json().catch(() => null)
  const body = typeof payload?.body === 'string' ? payload.body : ''

  const created = await createCommentForArticle({
    articleId: id,
    userId: user.id,
    body,
  })

  if (created.error || !created.comment) {
    return NextResponse.json({error: created.error ?? 'Unable to create comment.'}, {status: 400})
  }

  return NextResponse.json({data: created.comment}, {status: 201})
}
