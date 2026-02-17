import {actionLensLabel, type DefenseMoneyCard} from '@/lib/data/signals/types'

import {CitationLinks} from './citation-links'

type DataMoneyModuleProps = {
  heading: string
  card: DefenseMoneyCard | null
  emptyLabel: string
}

export function DataMoneyModule({heading, card, emptyLabel}: DataMoneyModuleProps) {
  const headingId = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return (
    <article className="news-divider-item px-1" aria-labelledby={`${headingId}-heading`}>
      <h3
        className="mb-2 text-xs font-semibold tracking-[0.12em] uppercase text-muted-foreground"
        id={`${headingId}-heading`}
      >
        {heading}
      </h3>

      {!card ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <>
          <p className="text-muted-foreground mb-1 text-xs tracking-[0.12em] uppercase">{actionLensLabel(card.actionLens)}</p>
          <p className="text-[1.05rem] leading-relaxed text-foreground">{card.summary}</p>
          <p className="text-muted-foreground mt-2 text-sm">{card.soWhat}</p>
          <CitationLinks citations={card.citations} max={5} />
        </>
      )}
    </article>
  )
}
