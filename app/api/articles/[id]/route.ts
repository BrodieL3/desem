import {NextResponse} from 'next/server'

import {getArticleById} from '@/lib/articles/server'
import {getAuthenticatedUser} from '@/lib/user/session'

type RouteContext = {
  params: Promise<{id: string}>
}

export async function GET(_request: Request, context: RouteContext) {
  const {id} = await context.params
  const user = await getAuthenticatedUser()

  const detail = await getArticleById(id, user?.id ?? null)

  if (!detail) {
    return NextResponse.json({error: 'Article not found.'}, {status: 404})
  }

  return NextResponse.json({
    data: {
      article: detail.article,
      fullText: detail.fullText,
      followedTopicIds: [...detail.followedTopicIds],
    },
  })
}
