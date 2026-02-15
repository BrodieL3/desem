import Link from 'next/link'

import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {getArticleListForApi} from '@/lib/articles/server'
import type {ArticleCard} from '@/lib/articles/types'
import {getUserSession} from '@/lib/user/session'

type SearchPageProps = {
  searchParams?: Promise<{q?: string}>
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function normalizeQuery(value: string | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ')
}

function compactText(value: string, maxChars: number) {
  const normalized = value.trim().replace(/\s+/g, ' ')

  if (normalized.length <= maxChars) {
    return normalized
  }

  const slice = normalized.slice(0, maxChars + 1)
  const breakIndex = slice.lastIndexOf(' ')
  const bounded = breakIndex > Math.floor(maxChars * 0.6) ? slice.slice(0, breakIndex) : slice.slice(0, maxChars)
  return `${bounded.trimEnd()}...`
}

function formatArticleDate(publishedAt: string | null, fetchedAt: string) {
  const parsed = new Date(publishedAt ?? fetchedAt)

  if (Number.isNaN(parsed.getTime())) {
    return publishedAt ?? fetchedAt
  }

  return dateFormatter.format(parsed)
}

function SearchResultRow({article}: {article: ArticleCard}) {
  const summary = compactText(article.summary ?? article.fullTextExcerpt ?? 'Open this story for full reporting.', 210)

  return (
    <article className="news-divider-item px-1">
      <Link
        href={`/articles/${article.id}`}
        className="group block rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">{article.sourceName}</span>
          <span className="text-muted-foreground">{formatArticleDate(article.publishedAt, article.fetchedAt)}</span>
          {article.commentCount > 0 ? <span className="text-muted-foreground">{article.commentCount} comments</span> : null}
        </div>

        <h2 className="font-display text-[1.95rem] leading-tight transition-colors group-hover:text-primary">{article.title}</h2>

        <p className="text-muted-foreground mt-3 text-base leading-relaxed">{summary}</p>
      </Link>

      {article.topics.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {article.topics.slice(0, 5).map((topic) => (
            <Badge key={`${article.id}-${topic.id}`} variant="secondary" className="text-xs">
              <Link href={`/topics/${topic.slug}`}>{topic.label}</Link>
            </Badge>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export default async function SearchPage({searchParams}: SearchPageProps) {
  const params = searchParams ? await searchParams : undefined
  const query = normalizeQuery(params?.q)
  const session = await getUserSession()
  const results = query
    ? await getArticleListForApi({
        query,
        limit: 80,
        userId: session.userId,
      })
    : []

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[1120px] p-5 md:p-8">
        <header className="mb-6 space-y-4 border-b border-border pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase">Search</p>
              <h1 className="font-display text-[2.4rem] leading-tight md:text-[3rem]">Coverage lookup</h1>
              <p className="text-muted-foreground text-base">Search across ingested defense reporting and open article details.</p>
            </div>

            <Button asChild variant="ghost" size="sm" className="min-h-11 px-4">
              <Link href="/">Back to front page</Link>
            </Button>
          </div>

          <form action="/search" className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="search-page-query" className="sr-only">
              Search query
            </label>
            <input
              id="search-page-query"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search companies, programs, countries, or systems"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
            />
            <Button type="submit" size="sm" className="min-h-11 px-5">
              Search
            </Button>
          </form>

          {query ? (
            <p className="text-sm text-muted-foreground">
              {results.length.toLocaleString()} results for <span className="font-medium text-foreground">&quot;{query}&quot;</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Enter a query to search top stories, topics, and sources.</p>
          )}
        </header>

        {!query ? (
          <p className="news-divider-list news-divider-item px-1 text-base text-muted-foreground">
            Start with at least one keyword to run a search.
          </p>
        ) : results.length === 0 ? (
          <p className="news-divider-list news-divider-item px-1 text-base text-muted-foreground">
            No results matched your query. Try a source name, topic, or defense company.
          </p>
        ) : (
          <section className="space-y-4" aria-labelledby="search-results-heading">
            <h2 id="search-results-heading" className="border-t border-border pt-4 text-xs tracking-[0.15em] uppercase text-muted-foreground">
              Results
            </h2>
            <div className="news-divider-list">
              {results.map((article) => (
                <SearchResultRow key={article.id} article={article} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
