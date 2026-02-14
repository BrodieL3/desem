import Link from 'next/link'

import {resolveInternalStoryHref} from '@/lib/editorial/linking'
import type {CuratedSourceLink} from '@/lib/editorial/ui-types'

type SourceLinkListProps = {
  clusterKey: string
  links: CuratedSourceLink[]
}

const roleOrder: CuratedSourceLink['sourceRole'][] = ['reporting', 'official', 'analysis', 'opinion']

const roleLabel: Record<CuratedSourceLink['sourceRole'], string> = {
  reporting: 'Reporting',
  official: 'Official',
  analysis: 'Analysis',
  opinion: 'Opinion',
}

export function SourceLinkList({clusterKey, links}: SourceLinkListProps) {
  const grouped = new Map<CuratedSourceLink['sourceRole'], CuratedSourceLink[]>()

  for (const link of links) {
    const items = grouped.get(link.sourceRole) ?? []
    items.push(link)
    grouped.set(link.sourceRole, items)
  }

  return (
    <section className="space-y-4 border-t border-border pt-6">
      <h2 className="font-display text-[2rem] leading-tight">Sources</h2>
      {links.length === 0 ? (
        <p className="text-muted-foreground text-base">No source links available for this story.</p>
      ) : (
        roleOrder.map((role) => {
          const roleLinks = grouped.get(role) ?? []

          if (roleLinks.length === 0) {
            return null
          }

          return (
            <section key={role} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
              <p className="text-muted-foreground text-[11px] tracking-[0.12em] uppercase">
                {roleLabel[role]} ({roleLinks.length})
              </p>
              <div className="news-divider-list">
                {roleLinks.map((link) => (
                  <Link
                    key={`${link.articleId}-${link.url}`}
                    href={resolveInternalStoryHref({
                      articleId: link.articleId,
                      clusterKey,
                    })}
                    className="news-divider-item block px-1 transition-colors hover:text-primary"
                  >
                    <p className="font-medium">{link.headline}</p>
                    <p className="text-muted-foreground mt-1 text-sm">{link.sourceName}</p>
                  </Link>
                ))}
              </div>
            </section>
          )
        })
      )}
    </section>
  )
}
