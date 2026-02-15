import type {DefenseMoneyCard} from '@/lib/data/signals/types'

import {CitationLinks} from './citation-links'

type DataMoneyModuleProps = {
  heading: string
  card: DefenseMoneyCard | null
  emptyLabel: string
}

export function DataMoneyModule({heading, card, emptyLabel}: DataMoneyModuleProps) {
  return (
    <section aria-labelledby={`${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-heading`}>
      <div className="mb-3 border-b border-border pb-3">
        <h2 className="font-display text-[1.9rem] leading-tight" id={`${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-heading`}>
          {heading}
        </h2>
      </div>

      {!card ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <article className="news-divider-list news-divider-list-no-top">
          <div className="news-divider-item px-1">
            <p className="text-muted-foreground text-xs tracking-[0.12em] uppercase">{card.actionLens.toUpperCase()}</p>
            <p className="text-[1.05rem] leading-relaxed text-foreground">{card.summary}</p>
            <p className="text-muted-foreground mt-2 text-sm">{card.soWhat}</p>
            <CitationLinks citations={card.citations} max={5} />
          </div>
        </article>
      )}
    </section>
  )
}
