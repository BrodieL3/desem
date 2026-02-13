import Link from 'next/link'
import {notFound} from 'next/navigation'

import {CommentThread} from '@/components/aggregator/comment-thread'
import {FollowTopicButton} from '@/components/aggregator/follow-topic-button'
import {ShareLinkButton} from '@/components/aggregator/share-link-button'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {getArticleById} from '@/lib/articles/server'
import {getCommentsForArticle} from '@/lib/comments/server'
import {getUserSession} from '@/lib/user/session'

type ArticlePageProps = {
  params: Promise<{id: string}>
}

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function paragraphize(text: string) {
  const explicitParagraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (explicitParagraphs.length >= 2) {
    return explicitParagraphs
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  const paragraphs: string[] = []

  for (let index = 0; index < sentences.length; index += 4) {
    paragraphs.push(sentences.slice(index, index + 4).join(' '))
  }

  return paragraphs.length > 0 ? paragraphs : [text]
}

export default async function ArticlePage({params}: ArticlePageProps) {
  const {id} = await params
  const session = await getUserSession()
  const detail = await getArticleById(id, session.userId)

  if (!detail) {
    notFound()
  }

  const comments = await getCommentsForArticle(detail.article.id, session.userId)

  const publishedAt = detail.article.publishedAt ?? detail.article.fetchedAt
  const paragraphs = paragraphize(detail.fullText ?? detail.article.summary ?? detail.article.fullTextExcerpt ?? '')

  return (
    <main className="min-h-screen px-3 py-4 md:px-6 md:py-7">
      <div className="editorial-shell mx-auto max-w-[1300px] border-slate-300/80 bg-white/95 px-4 py-6 md:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline" className="rounded-full border-slate-300 bg-white">
            <Link href="/">Back to front page</Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
          <article className="space-y-6">
            <header className="space-y-4 border-b border-slate-300/75 pb-6">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="border-slate-300 bg-white text-[11px] uppercase">
                  {detail.article.sourceBadge}
                </Badge>
                <span className="text-muted-foreground">Originally published by {detail.article.sourceName}.</span>
                <span className="text-muted-foreground">{timestampFormatter.format(new Date(publishedAt))}</span>
              </div>

              <h1 className="font-display text-4xl leading-tight text-slate-900 md:text-[3.1rem]">{detail.article.title}</h1>

              <p className="text-muted-foreground text-base leading-relaxed">
                {detail.article.summary ?? detail.article.fullTextExcerpt ?? 'No summary provided by source feed.'}
              </p>
            </header>

            {detail.article.leadImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detail.article.leadImageUrl}
                alt={detail.article.title}
                className="w-full rounded-2xl border border-slate-300/70 object-cover"
                loading="lazy"
              />
            ) : null}

            <section className="space-y-4">
              {paragraphs.map((paragraph, index) => (
                <p key={`${detail.article.id}-paragraph-${index}`} className="text-base leading-[1.85] text-slate-800">
                  {paragraph}
                </p>
              ))}
            </section>

            <CommentThread articleId={detail.article.id} isAuthenticated={session.isAuthenticated} initialComments={comments} />
          </article>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Card className="border-slate-300/75 bg-background">
              <CardHeader className="space-y-2">
                <CardTitle className="font-display text-3xl leading-tight">Topics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {detail.article.topics.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No topics extracted for this article.</p>
                ) : (
                  detail.article.topics.map((topic) => (
                    <div key={topic.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-300/75 bg-background px-3 py-2">
                      <Link href={`/topics/${topic.slug}`} className="text-sm font-medium text-slate-800 hover:text-[var(--brand)]">
                        {topic.label}
                      </Link>
                      <FollowTopicButton
                        topicId={topic.id}
                        initialFollowed={detail.followedTopicIds.has(topic.id)}
                        isAuthenticated={session.isAuthenticated}
                        className="h-7 rounded-full px-2 text-[11px]"
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-300/75 bg-background">
              <CardHeader className="space-y-2">
                <CardTitle className="font-display text-3xl leading-tight">Article actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full rounded-full">
                  <a href={detail.article.articleUrl} target="_blank" rel="noreferrer">
                    Open original source
                  </a>
                </Button>
                <ShareLinkButton className="w-full rounded-full border-slate-300 bg-background" />
                <div className="rounded-xl border border-slate-300/80 bg-background p-3 text-sm">
                  <p className="text-muted-foreground">
                    {detail.article.wordCount > 0
                      ? `${detail.article.wordCount.toLocaleString()} words | ${Math.max(1, detail.article.readingMinutes)} min read`
                      : 'Length unavailable'}
                  </p>
                  <p className="text-muted-foreground mt-1">{detail.article.commentCount} active comments</p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}
