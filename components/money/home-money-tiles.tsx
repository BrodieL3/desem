import Link from 'next/link'

import type {DefenseMoneyCard, DefenseMoneyThisWeekSignal} from '@/lib/data/signals/types'

import {CitationLinks} from './citation-links'

type HomeMoneyTilesProps = {
  dailySpendPulse: DefenseMoneyCard | null
  primeMoves: DefenseMoneyCard | null
  thisWeekSignal?: DefenseMoneyThisWeekSignal | null
}

function tileLabel(value: string) {
  return value.replace('_', ' ').toUpperCase()
}

function Tile({card}: {card: DefenseMoneyCard}) {
  return (
    <article className="news-divider-item px-1">
      <p className="text-muted-foreground mb-2 text-xs tracking-[0.12em] uppercase">
        {card.headline} · {tileLabel(card.actionLens)}
      </p>
      <p className="text-foreground text-[1.04rem] leading-relaxed">{card.summary}</p>
      <p className="text-muted-foreground mt-2 text-sm">{card.soWhat}</p>
      <CitationLinks citations={card.citations} max={2} />
    </article>
  )
}

export function HomeMoneyTiles({dailySpendPulse, primeMoves, thisWeekSignal}: HomeMoneyTilesProps) {
  if (!dailySpendPulse && !primeMoves) {
    return null
  }

  return (
    <section aria-labelledby="money-signals-heading" className="space-y-4">
      <div className="flex items-end justify-between gap-3 border-t border-border pt-4">
        <h2 id="money-signals-heading" className="text-xs tracking-[0.16em] uppercase text-muted-foreground">
          Money Signals
        </h2>
        <Link href="/data" className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline">
          Open full data briefing
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="news-divider-list news-divider-list-no-top">
          {dailySpendPulse ? <Tile card={dailySpendPulse} /> : <p className="news-divider-item px-1 text-sm text-muted-foreground">No daily spend pulse yet.</p>}
        </div>
        <div className="news-divider-list news-divider-list-no-top news-column-rule">
          {primeMoves ? <Tile card={primeMoves} /> : <p className="news-divider-item px-1 text-sm text-muted-foreground">No prime moves yet.</p>}
        </div>
      </div>

      {thisWeekSignal ? (
        <div className="news-divider-list news-divider-list-no-top">
          <article className="news-divider-item px-1">
            <p className="text-muted-foreground text-xs tracking-[0.12em] uppercase">
              This week&apos;s signal · {tileLabel(thisWeekSignal.actionLens)}
            </p>
            <p className="text-foreground text-[1rem] leading-relaxed">{thisWeekSignal.summary}</p>
            <p className="text-muted-foreground mt-2 text-sm">{thisWeekSignal.soWhat}</p>
            <CitationLinks citations={thisWeekSignal.citations} max={2} />
          </article>
        </div>
      ) : null}
    </section>
  )
}
