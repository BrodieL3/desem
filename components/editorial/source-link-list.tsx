import Link from 'next/link'

import {resolveInternalStoryHref} from '@/lib/editorial/linking'
import type {CuratedSourceLink} from '@/lib/editorial/ui-types'

type SourceLinkListProps = {
  clusterKey: string
  links: CuratedSourceLink[]
}

function sourceRoleLabel(role: CuratedSourceLink['sourceRole']) {
  if (role === 'official') {
    return 'Official'
  }

  if (role === 'analysis') {
    return 'Analysis'
  }

  if (role === 'opinion') {
    return 'Opinion'
  }

  return 'Reporting'
}

export function SourceLinkList({clusterKey, links}: SourceLinkListProps) {
  return (
    <section className="space-y-4 border-t border-border pt-6" aria-labelledby="story-sources-heading">
      <h2 id="story-sources-heading" className="font-display text-[1.9rem] leading-tight">
        Sources
      </h2>

      {links.length === 0 ? (
        <p className="text-muted-foreground text-base">No source links available for this story.</p>
      ) : (
        <div className="news-divider-list">
          {links.map((link) => (
            <Link
              key={`${link.articleId}-${link.url}`}
              href={resolveInternalStoryHref({
                articleId: link.articleId,
                clusterKey,
              })}
              className="news-divider-item block px-1 transition-colors hover:text-primary"
            >
              <p className="font-medium">{link.headline}</p>
              <p className="text-muted-foreground mt-1 text-xs tracking-[0.08em] uppercase">
                {link.sourceName} · {sourceRoleLabel(link.sourceRole)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
