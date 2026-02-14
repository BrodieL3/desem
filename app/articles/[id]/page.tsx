import {ChevronLeft} from 'lucide-react'
import Link from 'next/link'
import {redirect} from 'next/navigation'

import {CommentThread} from '@/components/aggregator/comment-thread'
import {ContinuousStoryFeed} from '@/components/aggregator/continuous-story-feed'
import {FollowTopicButton} from '@/components/aggregator/follow-topic-button'
import {ShareLinkButton} from '@/components/aggregator/share-link-button'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {getArticleById, getArticleListForApi} from '@/lib/articles/server'
import {getCommentsForArticle} from '@/lib/comments/server'
import {shouldDisplayNonAiImageUrl} from '@/lib/editorial/sightengine'
import {getCuratedStoryDetail} from '@/lib/editorial/ui-server'
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

function formatStoryTimestamp(publishedAt: string | null, fetchedAt: string) {
  const parsed = new Date(publishedAt ?? fetchedAt)

  if (Number.isNaN(parsed.getTime())) {
    return publishedAt ?? fetchedAt
  }

  return timestampFormatter.format(parsed)
}

function storySummary(summary: string | null, excerpt: string | null) {
  return summary ?? excerpt ?? 'Open this story for the latest reporting and discussion.'
}

function StoryListItem(props: {
  id: string
  title: string
  sourceName: string
  publishedAt: string | null
  fetchedAt: string
  summary: string | null
  excerpt: string | null
}) {
  return (
    <article className="news-divider-item px-1">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">{props.sourceName}</span>
        <span className="text-muted-foreground">{formatStoryTimestamp(props.publishedAt, props.fetchedAt)}</span>
      </div>

      <h3 className="font-display text-[1.7rem] leading-tight text-foreground">
        <Link href={`/articles/${props.id}`} className="hover:text-primary">
          {props.title}
        </Link>
      </h3>

      <p className="text-muted-foreground mt-2 text-base leading-relaxed">{storySummary(props.summary, props.excerpt)}</p>
    </article>
  )
}

export default async function ArticlePage({params}: ArticlePageProps) {
  const {id} = await params
  const session = await getUserSession()
  const detail = await getArticleById(id, session.userId)

  if (!detail) {
    const storyDetail = await getCuratedStoryDetail(id, {
      offset: 0,
      limit: 1,
    })

    if (storyDetail) {
      redirect(`/stories/${encodeURIComponent(storyDetail.clusterKey)}`)
    }

    const fallbackStories = await getArticleListForApi({
      limit: 30,
      userId: session.userId,
    })

    return (
      <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
        <div className="editorial-shell mx-auto max-w-[980px] p-5 md:p-8">
          <div className="mb-5">
            <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Back to front page">
              <Link href="/" title="Back to front page">
                <ChevronLeft className="size-5" />
              </Link>
            </Button>
          </div>

          <section className="mx-auto max-w-[74ch] space-y-5">
            <header className="space-y-2 border-b border-border pb-6 text-center">
              <p className="text-muted-foreground text-xs tracking-[0.14em] uppercase">Article unavailable</p>
              <h1 className="font-display text-[2.2rem] leading-tight">That article is no longer in this feed</h1>
              <p className="text-muted-foreground mx-auto max-w-2xl text-base">
                The URL points to an article ID that is not present in the current dataset.
              </p>
              <p className="text-muted-foreground text-xs break-all">{id}</p>
            </header>

            <div className="news-divider-list">
              {fallbackStories.length === 0 ? (
                <p className="py-5 text-base text-muted-foreground">No replacement stories are available right now.</p>
              ) : (
                fallbackStories.map((story) => (
                  <StoryListItem
                    key={story.id}
                    id={story.id}
                    title={story.title}
                    sourceName={story.sourceName}
                    publishedAt={story.publishedAt}
                    fetchedAt={story.fetchedAt}
                    summary={story.summary}
                    excerpt={story.fullTextExcerpt}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    )
  }

  const comments = await getCommentsForArticle(detail.article.id, session.userId)
  const primaryTopic = detail.article.topics.find((topic) => topic.isPrimary) ?? detail.article.topics[0] ?? null

  const [topicStories, latestStories] = await Promise.all([
    primaryTopic
      ? getArticleListForApi({
          topicSlug: primaryTopic.slug,
          limit: 36,
          userId: session.userId,
        })
      : Promise.resolve([]),
    getArticleListForApi({
      limit: 72,
      userId: session.userId,
    }),
  ])

  const storyStream: typeof latestStories = []
  const seenStoryIds = new Set<string>([detail.article.id])

  for (const story of [...topicStories, ...latestStories]) {
    if (seenStoryIds.has(story.id)) {
      continue
    }

    seenStoryIds.add(story.id)
    storyStream.push(story)

    if (storyStream.length >= 12) {
      break
    }
  }

  const publishedAt = detail.article.publishedAt ?? detail.article.fetchedAt
  const paragraphs = paragraphize(detail.fullText ?? detail.article.summary ?? detail.article.fullTextExcerpt ?? '')
  const showLeadImage = await shouldDisplayNonAiImageUrl(detail.article.leadImageUrl)

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[980px] p-5 md:p-8">
        <div className="mb-5">
          <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Back to front page">
            <Link href="/" title="Back to front page">
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
        </div>

        <article className="mx-auto w-full max-w-[74ch] space-y-8">
          <header className="space-y-4 border-b border-border pb-7 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <Badge variant="secondary" className="uppercase tracking-wide">
                {detail.article.sourceBadge}
              </Badge>
              <span className="text-muted-foreground">{detail.article.sourceName}</span>
              <span className="text-muted-foreground">{timestampFormatter.format(new Date(publishedAt))}</span>
            </div>

            <h1 className="font-display text-[2.45rem] leading-tight text-foreground md:text-[3rem]">{detail.article.title}</h1>

            <p className="text-muted-foreground text-lg leading-relaxed">
              {detail.article.summary ?? detail.article.fullTextExcerpt ?? 'No summary provided by source feed.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild>
                <a href={detail.article.articleUrl} target="_blank" rel="noreferrer">
                  Open original source
                </a>
              </Button>
              <ShareLinkButton />
            </div>

            <p className="text-muted-foreground text-sm">
              {detail.article.wordCount > 0
                ? `${detail.article.wordCount.toLocaleString()} words | ${Math.max(1, detail.article.readingMinutes)} min read`
                : 'Length unavailable'}
            </p>
          </header>

          {showLeadImage && detail.article.leadImageUrl ? (
            <figure className="story-prose space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detail.article.leadImageUrl} alt={detail.article.title} className="story-inline-image" loading="lazy" />
            </figure>
          ) : null}

          <section className="story-prose">
            <div className="story-prose-section">
              {paragraphs.map((paragraph, index) => (
                <p key={`${detail.article.id}-paragraph-${index}`}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-7" aria-labelledby="article-topics-heading">
            <header className="space-y-2 text-center">
              <h2 id="article-topics-heading" className="font-display text-[2rem] leading-tight">
                Topics
              </h2>
            </header>

            {detail.article.topics.length === 0 ? (
              <p className="py-5 text-base text-muted-foreground text-center">No topics extracted for this article.</p>
            ) : (
              <div className="news-divider-list">
                {detail.article.topics.map((topic) => (
                  <div key={topic.id} className="news-divider-item flex min-h-11 items-center justify-between gap-3 px-1">
                    <Link href={`/topics/${topic.slug}`} className="text-sm font-medium hover:text-primary">
                      {topic.label}
                    </Link>
                    <FollowTopicButton
                      topicId={topic.id}
                      initialFollowed={detail.followedTopicIds.has(topic.id)}
                      isAuthenticated={session.isAuthenticated}
                      className="h-11 px-3 text-xs"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <ContinuousStoryFeed
            initialStories={storyStream}
            excludeArticleIds={[detail.article.id]}
            topicSlug={primaryTopic?.slug ?? undefined}
            heading="Continuous coverage"
          />

          <CommentThread articleId={detail.article.id} isAuthenticated={session.isAuthenticated} initialComments={comments} />
        </article>
      </div>
    </main>
  )
}
