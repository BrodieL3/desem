import {SectionKicker} from '@/components/newsfeed/atoms/section-kicker'
import {Badge} from '@/components/ui/badge'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import type {IngestedFeedArticle} from '@/lib/ingest/recent-articles'

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

type LiveWireProps = {
  isAuthenticated: boolean
  articles: IngestedFeedArticle[]
}

function formatTimestamp(publishedAt?: string, fallback?: string) {
  const preferred = publishedAt ?? fallback

  if (!preferred) {
    return 'Unknown date'
  }

  const parsed = new Date(preferred)
  if (Number.isNaN(parsed.getTime())) {
    return preferred
  }

  return timestampFormatter.format(parsed)
}

export function LiveWire({isAuthenticated, articles}: LiveWireProps) {
  return (
    <Card className="border-slate-300/70 bg-white/90">
      <CardHeader className="space-y-1">
        <SectionKicker label="Live wire" />
        <CardTitle className="font-display text-3xl leading-tight text-slate-900">Pulled defense articles</CardTitle>
        <p className="text-muted-foreground text-sm">
          {isAuthenticated
            ? 'Daily-ingested stories ranked against your mission, domain, and tech interests.'
            : 'Daily-ingested stories from defense and official sources.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {articles.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No pulled articles yet. Run the ingestion job or wait for the next scheduled cron run.
          </p>
        ) : (
          articles.map((article) => (
            <article key={article.id} className="space-y-2 rounded-xl border border-slate-300/75 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="border-slate-300 bg-white text-[11px] uppercase">
                  {article.sourceBadge}
                </Badge>
                <span className="text-muted-foreground">{article.sourceName}</span>
                <span className="text-muted-foreground">{formatTimestamp(article.publishedAt, article.fetchedAt)}</span>
                {article.personalizationScore > 0 ? (
                  <Badge variant="secondary" className="bg-slate-900 text-[11px] text-white">
                    Matches your interests
                  </Badge>
                ) : null}
              </div>

              <h3 className="font-display text-2xl leading-tight text-slate-900">
                <a href={article.articleUrl} target="_blank" rel="noreferrer" className="transition-colors hover:text-[var(--brand)]">
                  {article.title}
                </a>
              </h3>

              {article.summary ? <p className="text-muted-foreground text-sm leading-relaxed">{article.summary}</p> : null}

              <div className="flex flex-wrap gap-1.5">
                {article.missionTags.slice(0, 3).map((tag) => (
                  <Badge key={`${article.id}-mission-${tag}`} variant="secondary" className="bg-slate-100 text-[11px]">
                    {tag}
                  </Badge>
                ))}
                {article.domainTags.slice(0, 2).map((tag) => (
                  <Badge key={`${article.id}-domain-${tag}`} variant="outline" className="border-slate-300 text-[11px]">
                    {tag}
                  </Badge>
                ))}
                {article.technologyTags.slice(0, 3).map((tag) => (
                  <Badge key={`${article.id}-tech-${tag}`} variant="outline" className="border-slate-300 text-[11px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  )
}
