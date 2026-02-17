import {BackToFrontPageButton} from '@/components/back-to-front-page-button'
import {MacroRiskCard, PrimeSparklinesChart} from '@/components/money'
import {AwardMatrixChart} from '@/components/money/charts/award-matrix-chart'
import {getDefenseMoneyChartsData} from '@/lib/data/signals/charts-server'
import {getGprData} from '@/lib/data/signals/gpr-server'

export default async function DataPage() {
  const moneyCharts = await getDefenseMoneyChartsData()
  const gprSummary = await getGprData()

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[1380px] p-5 md:p-8">
        <div className="mb-5">
          <BackToFrontPageButton />
        </div>

        <header className="mb-8 border-b border-border pb-6">
          <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">Field Brief</p>
          <h1 className="font-display text-4xl leading-tight">Awards</h1>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <AwardMatrixChart />
          </div>

          <aside className="news-column-rule right-rail-scroll space-y-1">
            {gprSummary.latest ? (
              <div className="news-divider-list news-divider-list-no-top">
                <MacroRiskCard summary={gprSummary} />
              </div>
            ) : null}

            <div className="news-divider-list news-divider-list-no-top">
              <div className="news-divider-item px-1">
                <PrimeSparklinesChart module={moneyCharts.primeSparklines} stale={moneyCharts.staleData.market} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
