import Link from 'next/link'

import type { GprSummary } from "@/lib/data/signals/gpr-server";
import {actionLensLabel, type DefenseMoneyActionLens, type DefenseMoneyCard, type DefenseMoneyThisWeekSignal} from '@/lib/data/signals/types'

import {CitationLinks} from './citation-links'
import { MacroRiskCard } from "./macro-risk-card";

type HomeMoneyTilesProps = {
  dailySpendPulse: DefenseMoneyCard | null;
  primeMoves: DefenseMoneyCard | null;
  thisWeekSignal?: DefenseMoneyThisWeekSignal | null;
  gprSummary?: GprSummary | null;
};

function tileLabel(value: string) {
  return actionLensLabel(value as DefenseMoneyActionLens)
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

export function HomeMoneyTiles({
  dailySpendPulse,
  primeMoves,
  thisWeekSignal,
  gprSummary,
}: HomeMoneyTilesProps) {
  return (
    <section aria-labelledby="money-signals-heading" className="space-y-0">
      <div className="flex items-end justify-between gap-3">
        <Link
          href="/awards"
          className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Open full data briefing
        </Link>
      </div>

      {gprSummary?.latest ? (
        <div className="news-divider-list news-divider-list-no-top">
          <MacroRiskCard summary={gprSummary} />
        </div>
      ) : thisWeekSignal ? (
        <div className="news-divider-list news-divider-list-no-top">
          <article className="news-divider-item px-1">
            <p className="text-muted-foreground text-xs tracking-[0.12em] uppercase">
              This week&apos;s signal · {tileLabel(thisWeekSignal.actionLens)}
            </p>
            <p className="text-foreground text-[1rem] leading-relaxed">
              {thisWeekSignal.summary}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              {thisWeekSignal.soWhat}
            </p>
            <CitationLinks citations={thisWeekSignal.citations} max={2} />
          </article>
        </div>
      ) : null}
    </section>
  );
}
