import {createSupabaseServerClient} from '@/lib/supabase/server'
import {createOptionalSupabaseAdminClientFromEnv} from '@/lib/supabase/admin'

import type {ArticleComment} from '@/lib/articles/types'

type CommentRow = {
  id: string
  article_id: string
  user_id: string
  body: string
  status: 'active' | 'hidden'
  created_at: string
  updated_at: string
}

function normalizeReason(value: string) {
  return value.trim().slice(0, 400)
}

export async function getCommentsForArticle(articleId: string, viewerUserId?: string | null): Promise<ArticleComment[]> {
  const admin = createOptionalSupabaseAdminClientFromEnv()
  const client = admin ?? (await createSupabaseServerClient())

  if (!client) {
    return []
  }

  const {data, error} = await client
    .from('article_comments')
    .select('id, article_id, user_id, body, status, created_at, updated_at')
    .eq('article_id', articleId)
    .order('created_at', {ascending: true})
    .returns<CommentRow[]>()

  if (error || !data) {
    return []
  }

  let reportedByViewer = new Set<string>()

  if (viewerUserId) {
    const {data: reportRows} = await client
      .from('comment_reports')
      .select('comment_id')
      .eq('reporter_user_id', viewerUserId)
      .returns<Array<{comment_id: string}>>()

    reportedByViewer = new Set((reportRows ?? []).map((row) => row.comment_id))
  }

  return data.map((comment) => ({
    id: comment.id,
    articleId: comment.article_id,
    userId: comment.user_id,
    body: comment.status === 'active' ? comment.body : null,
    status: comment.status,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    isOwn: viewerUserId ? comment.user_id === viewerUserId : false,
    reportedByViewer: reportedByViewer.has(comment.id),
  }))
}

export async function createCommentForArticle(input: {
  articleId: string
  userId: string
  body: string
}): Promise<{comment: ArticleComment | null; error: string | null}> {
  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    return {
      comment: null,
      error: 'Supabase is not configured.',
    }
  }

  const body = input.body.trim()

  if (!body || body.length > 2000) {
    return {
      comment: null,
      error: 'Comment body must be between 1 and 2000 characters.',
    }
  }

  const {data, error} = await supabase
    .from('article_comments')
    .insert({
      article_id: input.articleId,
      user_id: input.userId,
      body,
      status: 'active',
    })
    .select('id, article_id, user_id, body, status, created_at, updated_at')
    .single<CommentRow>()

  if (error || !data) {
    return {
      comment: null,
      error: error?.message ?? 'Unable to create comment.',
    }
  }

  return {
    comment: {
      id: data.id,
      articleId: data.article_id,
      userId: data.user_id,
      body: data.body,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isOwn: true,
      reportedByViewer: false,
    },
    error: null,
  }
}

export async function reportComment(input: {
  commentId: string
  reporterUserId: string
  reason: string
}): Promise<{ok: boolean; error: string | null; duplicate: boolean}> {
  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    return {
      ok: false,
      error: 'Supabase is not configured.',
      duplicate: false,
    }
  }

  const reason = normalizeReason(input.reason)

  if (!reason) {
    return {
      ok: false,
      error: 'Report reason is required.',
      duplicate: false,
    }
  }

  const {error} = await supabase.from('comment_reports').insert({
    comment_id: input.commentId,
    reporter_user_id: input.reporterUserId,
    reason,
  })

  if (!error) {
    return {
      ok: true,
      error: null,
      duplicate: false,
    }
  }

  if (error.code === '23505') {
    return {
      ok: false,
      error: 'You already reported this comment.',
      duplicate: true,
    }
  }

  return {
    ok: false,
    error: error.message,
    duplicate: false,
  }
}
