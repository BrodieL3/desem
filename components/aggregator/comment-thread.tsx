'use client'

import Link from 'next/link'
import {FormEvent, useMemo, useState} from 'react'

import {Button} from '@/components/ui/button'
import type {ArticleComment} from '@/lib/articles/types'

type CommentThreadProps = {
  articleId: string
  isAuthenticated: boolean
  initialComments: ArticleComment[]
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function commentAuthor(userId: string, isOwn: boolean) {
  if (isOwn) {
    return 'You'
  }

  return `Reader ${userId.slice(0, 8)}`
}

export function CommentThread({articleId, isAuthenticated, initialComments}: CommentThreadProps) {
  const [comments, setComments] = useState(initialComments)
  const [body, setBody] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const activeCommentCount = useMemo(
    () => comments.filter((comment) => comment.status === 'active').length,
    [comments]
  )

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isAuthenticated) {
      return
    }

    const nextBody = body.trim()

    if (!nextBody) {
      setStatus('Write a comment before posting.')
      return
    }

    setIsSubmitting(true)
    setStatus(null)

    try {
      const response = await fetch(`/api/articles/${articleId}/comments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({body: nextBody}),
      })

      const payload = (await response.json()) as {data?: ArticleComment; error?: string}

      if (!response.ok || !payload.data) {
        setStatus(payload.error ?? 'Unable to post comment.')
        setIsSubmitting(false)
        return
      }

      setComments((current) => [...current, payload.data!])
      setBody('')
      setStatus('Comment posted.')
      setIsSubmitting(false)
    } catch {
      setStatus('Unable to post comment.')
      setIsSubmitting(false)
    }
  }

  async function report(commentId: string) {
    if (!isAuthenticated) {
      return
    }

    const reason = 'Potential abuse or policy violation'

    const response = await fetch(`/api/comments/${commentId}/report`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({reason}),
    })

    const payload = (await response.json().catch(() => null)) as {error?: string} | null

    if (!response.ok && payload?.error) {
      setStatus(payload.error)
      return
    }

    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              reportedByViewer: true,
            }
          : comment
      )
    )
  }

  return (
    <section className="space-y-5 border-t border-border pt-8" aria-labelledby="discussion-heading">
      <header className="space-y-1">
        <h2 id="discussion-heading" className="font-display text-3xl leading-tight">
          Discussion
        </h2>
        <p className="text-muted-foreground text-sm">{activeCommentCount} published comments</p>
      </header>
      <div className="space-y-5">
        {isAuthenticated ? (
          <form onSubmit={submitComment} className="space-y-3 border-t border-border pt-4">
            <label className="text-sm font-medium" htmlFor="comment-body">
              Add your take
            </label>
            <textarea
              id="comment-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              className="w-full border-b border-input bg-transparent px-0 py-2 text-sm leading-relaxed"
              placeholder="What stood out to you in this article?"
              maxLength={2000}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs">Max 2000 characters</span>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Posting…' : 'Post comment'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="border-t border-border pt-4 text-sm">
            <p className="text-muted-foreground">Sign in to comment and follow discussion threads.</p>
            <Button asChild size="sm" className="mt-3">
              <Link href={`/auth/sign-in?next=${encodeURIComponent(`/stories/article/${articleId}`)}`}>Sign in</Link>
            </Button>
          </div>
        )}

        {status ? (
          <p aria-live="polite" className="text-muted-foreground border-t border-border pt-3 text-sm">
            {status}
          </p>
        ) : null}

        <div className="news-divider-list">
          {comments.length === 0 ? (
            <p className="news-divider-item text-muted-foreground text-sm">No comments yet. Start the discussion.</p>
          ) : (
            comments.map((comment) => (
              <article key={comment.id} className="news-divider-item px-1">
                <header className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">{commentAuthor(comment.userId, comment.isOwn)}</span>
                  <span className="text-muted-foreground">{dateFormatter.format(new Date(comment.createdAt))}</span>
                  {comment.status === 'hidden' ? (
                    <span className="bg-warning/20 text-warning-foreground rounded-full px-2 py-0.5 text-[11px]">
                      Hidden by moderation
                    </span>
                  ) : null}
                </header>

                <p className="text-sm leading-relaxed">
                  {comment.status === 'active' ? comment.body : 'This comment was hidden by moderation.'}
                </p>

                {isAuthenticated && comment.status === 'active' && !comment.isOwn ? (
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-10 px-3 text-xs"
                      disabled={comment.reportedByViewer}
                      onClick={() => report(comment.id)}
                    >
                      {comment.reportedByViewer ? 'Reported' : 'Report'}
                    </Button>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
