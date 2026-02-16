import {BackToFrontPageButton} from '@/components/back-to-front-page-button'
import {
  AlertsPanel,
  BacklogComparisonChart,
  BookToBillTrendChart,
  MetricsTable,
  ModuleShell,
  RelationshipPlaceholder,
  SourcesDrawer,
} from '@/components/data'
import {
  ConcentrationTrendChart,
  ContractVelocityChart,
  DataMoneyModule,
  DemandMomentumChart,
  NewsMoneyHeatmap,
  PipelineFunnelChart,
  PrimeSparklinesChart,
  RecipientLeaderboardChart,
  WeeklyCategoryShareChart,
} from '@/components/money'
import {Card, CardContent} from '@/components/ui/card'
import {getContractVelocityData, getDefenseMoneyChartsData, getNewsMoneyHeatmapData} from '@/lib/data/signals/charts-server'
import {getSamGovPipelineData} from '@/lib/data/signals/sam-gov-server'
import {getDefenseMoneySignalData} from '@/lib/data/signals/server'
import {getPrimeDashboardData, isPrimeDataEnabled} from '@/lib/data/primes/server'

function countSeverities(alerts: Awaited<ReturnType<typeof getPrimeDashboardData>>['alerts']) {
  return alerts.reduce(
    (acc, alert) => {
      acc[alert.severity] += 1
      return acc
    },
    {info: 0, warning: 0, critical: 0}
  )
}

export default async function DataPage() {
  const primeEnabled = isPrimeDataEnabled()

  const dashboard = await getPrimeDashboardData({
    windowQuarters: 20,
  })
  const moneySignals = await getDefenseMoneySignalData()
  const moneyCharts = await getDefenseMoneyChartsData()
  const contractVelocity = await getContractVelocityData()
  const pipelineData = await getSamGovPipelineData()
  const heatmapData = await getNewsMoneyHeatmapData()
  const bookToBillSeries = dashboard.series.find((series) => series.metricKey === 'book_to_bill')?.points ?? []
  const backlogSeries = dashboard.series.find((series) => series.metricKey === 'backlog_total_b')?.points ?? []
  const severityCounts = countSeverities(dashboard.alerts)

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[1380px] space-y-7 p-5 md:p-8">
        <div className="mb-5">
          <BackToFrontPageButton />
        </div>

        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">Field Brief</p>
            <h1 className="font-display text-4xl leading-tight">Data</h1>
            <p className="text-muted-foreground mt-1 max-w-3xl text-base">
              Mission-linked defense money signals plus prime backlog and book-to-bill context.
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Last updated {new Date(dashboard.generatedAt).toLocaleString('en-US', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'})}
              {dashboard.tableRows.length > 0 ? ` · ${dashboard.tableRows.length} quarterly records` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {primeEnabled && dashboard.staleData ? (
              <p className="rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
                Prime data last updated {new Date(dashboard.generatedAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}. Next refresh at 11:00 AM UTC.
              </p>
            ) : null}
            {!primeEnabled ? (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Prime metrics (backlog &amp; book-to-bill) are not active in this environment.
              </p>
            ) : null}
            {moneySignals.staleData.daily ? (
              <p className="rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
                Money signals last updated {new Date(moneySignals.generatedAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}. Next refresh at 11:00 AM UTC.
              </p>
            ) : null}
          </div>
        </header>

        <ModuleShell
          header={{
            eyebrow: 'Morning',
            title: 'Defense-tech money signals',
            description: 'Mission-linked money movement with explicit implications for builders and BD teams.',
          }}
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <DataMoneyModule
              heading="Daily spend pulse"
              card={moneySignals.dailySpendPulse}
              emptyLabel="No daily spend pulse is available yet."
            />
            <DataMoneyModule heading="Prime moves" card={moneySignals.primeMoves} emptyLabel="No prime moves are available yet." />
            <DataMoneyModule
              heading="New awards you should know"
              card={moneySignals.newAwards}
              emptyLabel="No high-signal awards were captured for this day."
            />
            <DataMoneyModule
              heading="Macro budget context"
              card={moneySignals.macroContext}
              emptyLabel="No macro budget context entry is available yet."
            />
          </div>
        </ModuleShell>

        <ModuleShell
          header={{
            eyebrow: 'Structural',
            title: 'Weekly and monthly shifts',
            description: 'Category-share momentum and winner concentration in recent DoD obligations.',
          }}
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <DataMoneyModule
              heading="Weekly structural shifts"
              card={moneySignals.weeklyStructural}
              emptyLabel="No weekly structural shift card is available yet."
            />
            <DataMoneyModule
              heading="Monthly structural shifts"
              card={moneySignals.monthlyStructural}
              emptyLabel="No monthly structural shift card is available yet."
            />
          </div>
        </ModuleShell>

        <ModuleShell
          header={{
            eyebrow: 'Pipeline',
            title: 'Pipeline intelligence',
            description: 'Forward-looking DoD opportunity pipeline from SAM.gov — pre-solicitations, active solicitations, and bucket distribution.',
          }}
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <PipelineFunnelChart
              solicitations={pipelineData.activeSolicitations.length}
              presolicitations={pipelineData.recentPresolicitations.length}
              pipelineByBucket={pipelineData.pipelineByBucket}
              totalActive={pipelineData.totalActive}
            />
            <Card className="rounded-lg border border-border bg-card">
              <CardContent className="space-y-3 py-5">
                <p className="text-xs tracking-[0.12em] uppercase text-muted-foreground">Approaching deadlines</p>
                {pipelineData.activeSolicitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active solicitations with approaching deadlines.</p>
                ) : (
                  <ul className="space-y-2">
                    {pipelineData.activeSolicitations.slice(0, 5).map((opp) => (
                      <li key={opp.opportunityId} className="text-sm">
                        <a href={opp.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {opp.title.slice(0, 80)}{opp.title.length > 80 ? '...' : ''}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {opp.department ?? 'DoD'} · Deadline: {opp.responseDeadline ?? 'TBD'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </ModuleShell>

        <ModuleShell
          header={{
            eyebrow: 'Charts',
            title: 'Money signal charts',
            description: 'Curated trend views for demand momentum, category share, concentration, recipients, and prime moves.',
          }}
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <DemandMomentumChart module={moneyCharts.demandMomentum} stale={moneyCharts.staleData.awards} />
            <ContractVelocityChart
              points={contractVelocity.points}
              stale={moneyCharts.staleData.awards}
              gapAnnotation={contractVelocity.gapAnnotation}
            />
            <WeeklyCategoryShareChart module={moneyCharts.weeklyCategoryShare} stale={moneyCharts.staleData.rollups} />
            <ConcentrationTrendChart module={moneyCharts.concentrationTrend} stale={moneyCharts.staleData.rollups} />
            <RecipientLeaderboardChart module={moneyCharts.recipientLeaderboard} stale={moneyCharts.staleData.awards} />
            <PrimeSparklinesChart module={moneyCharts.primeSparklines} stale={moneyCharts.staleData.market} />
            <NewsMoneyHeatmap cells={heatmapData.cells} topicLabels={heatmapData.topicLabels} bucketLabels={heatmapData.bucketLabels} />
          </div>
        </ModuleShell>

        {primeEnabled ? (
          <>
            <ModuleShell
              header={{
                eyebrow: 'Alerts',
                title: 'Prime signal monitor',
                description: 'Latest quarter warnings and disclosure gaps for backlog and book-to-bill.',
              }}
            >
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <Card className="rounded-lg border border-border bg-card">
                  <CardContent className="flex items-center justify-between py-4">
                    <p className="text-sm text-muted-foreground">Critical</p>
                    <p className="text-2xl font-semibold text-destructive">{severityCounts.critical}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-lg border border-border bg-card">
                  <CardContent className="flex items-center justify-between py-4">
                    <p className="text-sm text-muted-foreground">Warning</p>
                    <p className="text-2xl font-semibold text-warning-foreground">{severityCounts.warning}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-lg border border-border bg-card">
                  <CardContent className="flex items-center justify-between py-4">
                    <p className="text-sm text-muted-foreground">Info</p>
                    <p className="text-2xl font-semibold text-foreground">{severityCounts.info}</p>
                  </CardContent>
                </Card>
              </div>

              <AlertsPanel alerts={dashboard.alerts} />
            </ModuleShell>

            <ModuleShell
              header={{
                eyebrow: 'Charts',
                title: 'Trend analysis',
                description: 'Cross-prime trend views optimized for fast scan and quarter-over-quarter context.',
              }}
            >
              <div className="grid gap-4 xl:grid-cols-2">
                <BookToBillTrendChart companies={dashboard.companies} points={bookToBillSeries} />
                <BacklogComparisonChart companies={dashboard.companies} points={backlogSeries} />
              </div>
            </ModuleShell>

            <ModuleShell
              header={{
                eyebrow: 'Table',
                title: 'Quarterly detail',
                description: 'Sortable company-quarter detail with explicit not-disclosed handling and source links.',
              }}
            >
              <MetricsTable rows={dashboard.tableRows} companies={dashboard.companies} />
            </ModuleShell>

            <ModuleShell
              header={{
                eyebrow: 'Sources',
                title: 'Methodology and provenance',
                description: 'Only official disclosures are used for canonical values. Missing values remain not disclosed.',
              }}
              actions={<SourcesDrawer sources={dashboard.sources} />}
            >
              <Card className="rounded-lg border border-border bg-card">
                <CardContent className="space-y-2 py-4 text-sm text-muted-foreground">
                  <p>Scope: company-level metrics for LMT, RTX, BA, GD, NOC, and LHX.</p>
                  <p>Window: latest {dashboard.windowQuarters} fiscal quarters per company.</p>
                  <p>No derived estimates are generated in this module.</p>
                </CardContent>
              </Card>
            </ModuleShell>

            <ModuleShell
              header={{
                eyebrow: 'Future',
                title: 'Company collaboration signals',
                description: 'Schema and UX reserved for future verified relationship-event analytics.',
              }}
            >
              <RelationshipPlaceholder />
            </ModuleShell>
          </>
        ) : (
          <ModuleShell
            header={{
              eyebrow: 'Prime module',
              title: 'Prime metrics',
              description: 'Backlog and book-to-bill data for major defense primes.',
            }}
          >
            <Card className="rounded-lg border border-border bg-card">
              <CardContent className="py-5 text-base text-muted-foreground">
                Prime metrics are not active in this environment. Money-signal sections above remain active.
              </CardContent>
            </Card>
          </ModuleShell>
        )}
      </div>
    </main>
  )
}
