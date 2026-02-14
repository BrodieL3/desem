import Link from 'next/link'

import {
  AlertsPanel,
  BacklogComparisonChart,
  BookToBillTrendChart,
  MetricsTable,
  ModuleShell,
  RelationshipPlaceholder,
  SourcesDrawer,
} from '@/components/data'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
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
  const enabled = isPrimeDataEnabled()

  if (!enabled) {
    return (
      <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
        <div className="editorial-shell mx-auto max-w-[1100px] p-5 md:p-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
            <div>
              <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">Field Brief</p>
              <h1 className="font-display text-4xl leading-tight">Data</h1>
              <p className="text-muted-foreground mt-1 text-base">Prime metrics module is currently disabled in this environment.</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/">Back to front page</Link>
            </Button>
          </header>

          <Card className="rounded-lg border border-border bg-card">
            <CardHeader>
              <CardTitle className="font-display text-3xl leading-tight">Module disabled</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-base">
              Set <code>DATA_PRIMES_ENABLED=true</code> to activate the Backlog + Book-to-Bill data hub.
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  const dashboard = await getPrimeDashboardData({
    windowQuarters: 20,
  })
  const bookToBillSeries = dashboard.series.find((series) => series.metricKey === 'book_to_bill')?.points ?? []
  const backlogSeries = dashboard.series.find((series) => series.metricKey === 'backlog_total_b')?.points ?? []
  const severityCounts = countSeverities(dashboard.alerts)

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[1380px] space-y-7 p-5 md:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">Field Brief</p>
            <h1 className="font-display text-4xl leading-tight">Data</h1>
            <p className="text-muted-foreground mt-1 max-w-3xl text-base">
              Prime backlog and book-to-bill monitoring across the latest {dashboard.windowQuarters} quarters.
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Generated {new Date(dashboard.generatedAt).toLocaleString()} · {dashboard.tableRows.length} records
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dashboard.staleData ? (
              <p className="rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
                Data may be stale. Ingestion check required.
              </p>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href="/">Back to front page</Link>
            </Button>
          </div>
        </header>

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
              <p>Scope: company-level metrics for LMT, RTX, BA, GD, and NOC.</p>
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
      </div>
    </main>
  )
}
