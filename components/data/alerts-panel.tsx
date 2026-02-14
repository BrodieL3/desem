import Link from 'next/link'

import {Badge} from '@/components/ui/badge'
import {Card, CardContent} from '@/components/ui/card'

import type {PrimeAlertsPanelProps} from './types'

function severityLabel(severity: 'info' | 'warning' | 'critical') {
  if (severity === 'critical') {
    return 'Critical'
  }

  if (severity === 'warning') {
    return 'Warning'
  }

  return 'Info'
}

function severityClass(severity: 'info' | 'warning' | 'critical') {
  if (severity === 'critical') {
    return 'bg-destructive/15 text-destructive'
  }

  if (severity === 'warning') {
    return 'bg-warning/20 text-warning-foreground'
  }

  return 'bg-secondary text-secondary-foreground'
}

function ruleLabel(rule: 'book_to_bill_below_1' | 'backlog_yoy_decline' | 'disclosure_gap') {
  if (rule === 'book_to_bill_below_1') {
    return 'Book-to-bill < 1'
  }

  if (rule === 'backlog_yoy_decline') {
    return 'Backlog YoY decline'
  }

  return 'Disclosure gap'
}

export function AlertsPanel({alerts}: PrimeAlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <Card className="rounded-lg border border-border bg-card">
        <CardContent className="py-5 text-base text-muted-foreground">No active prime-metrics alerts for the latest quarter.</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <article key={alert.id} className="rounded-lg border border-border bg-card px-4 py-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={severityClass(alert.severity)}>
              {severityLabel(alert.severity)}
            </Badge>
            <Badge variant="secondary" className="uppercase tracking-wide">
              {alert.ticker}
            </Badge>
            <span className="text-muted-foreground text-xs">{alert.periodLabel}</span>
            <span className="text-muted-foreground text-xs">{ruleLabel(alert.rule)}</span>
          </div>

          <p className="text-base leading-relaxed text-foreground">{alert.message}</p>

          {alert.sourceUrl ? (
            <p className="mt-2 text-sm">
              <Link href={alert.sourceUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                View source filing
              </Link>
            </p>
          ) : null}
        </article>
      ))}
    </div>
  )
}
