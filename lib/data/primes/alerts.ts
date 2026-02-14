import type {PrimeAlert, PrimeTableRow, PrimeTicker} from './types'
import {primeTickerValues} from './types'

type QuarterToken = {
  quarter: number
  year: number
}

function parseQuarterLabel(value: string): QuarterToken | null {
  const match = value.match(/Q([1-4])\s+(\d{4})/i)

  if (!match) {
    return null
  }

  return {
    quarter: Number.parseInt(match[1] ?? '0', 10),
    year: Number.parseInt(match[2] ?? '0', 10),
  }
}

function sortRowsDescending(rows: PrimeTableRow[]) {
  return [...rows].sort((left, right) => Date.parse(right.periodEnd) - Date.parse(left.periodEnd))
}

function sourceFromRow(row: PrimeTableRow | undefined) {
  if (!row) {
    return null
  }

  return row.sourceLinks[0] ?? null
}

function findYearAgoRow(rows: PrimeTableRow[], latest: PrimeTableRow) {
  const latestQuarter = parseQuarterLabel(latest.periodLabel)

  if (!latestQuarter) {
    return rows[4]
  }

  return rows.find((row) => {
    if (row === latest) {
      return false
    }

    const token = parseQuarterLabel(row.periodLabel)

    if (!token) {
      return false
    }

    return token.quarter === latestQuarter.quarter && token.year === latestQuarter.year - 1
  })
}

function buildDisclosureGapMessages(input: {ticker: PrimeTicker; latest: PrimeTableRow}) {
  const messages: PrimeAlert[] = []

  if (input.latest.backlogTotalB === null) {
    messages.push({
      id: `${input.ticker}-${input.latest.periodLabel}-disclosure-backlog`,
      ticker: input.ticker,
      periodLabel: input.latest.periodLabel,
      severity: 'info',
      rule: 'disclosure_gap',
      message: `${input.ticker} did not disclose consolidated backlog for ${input.latest.periodLabel}.`,
      sourceUrl: sourceFromRow(input.latest),
    })
  }

  if (input.latest.bookToBill === null) {
    messages.push({
      id: `${input.ticker}-${input.latest.periodLabel}-disclosure-btb`,
      ticker: input.ticker,
      periodLabel: input.latest.periodLabel,
      severity: 'info',
      rule: 'disclosure_gap',
      message: `${input.ticker} did not disclose book-to-bill for ${input.latest.periodLabel}.`,
      sourceUrl: sourceFromRow(input.latest),
    })
  }

  return messages
}

export function buildPrimeAlerts(tableRows: PrimeTableRow[]): PrimeAlert[] {
  const byTicker = new Map<PrimeTicker, PrimeTableRow[]>()

  for (const ticker of primeTickerValues) {
    byTicker.set(ticker, [])
  }

  for (const row of tableRows) {
    const rows = byTicker.get(row.ticker as PrimeTicker)

    if (!rows) {
      continue
    }

    rows.push(row)
  }

  const alerts: PrimeAlert[] = []

  for (const ticker of primeTickerValues) {
    const rows = sortRowsDescending(byTicker.get(ticker) ?? [])
    const latest = rows[0]

    if (!latest) {
      continue
    }

    if (latest.bookToBill !== null && latest.bookToBill < 1) {
      alerts.push({
        id: `${ticker}-${latest.periodLabel}-btb-below-1`,
        ticker,
        periodLabel: latest.periodLabel,
        severity: 'warning',
        rule: 'book_to_bill_below_1',
        message: `${ticker} book-to-bill is ${latest.bookToBill.toFixed(2)} in ${latest.periodLabel}, below 1.0.`,
        sourceUrl: sourceFromRow(latest),
      })
    }

    const yearAgo = findYearAgoRow(rows, latest)

    if (latest.backlogTotalB !== null && yearAgo && yearAgo.backlogTotalB !== null && latest.backlogTotalB < yearAgo.backlogTotalB) {
      const delta = latest.backlogTotalB - yearAgo.backlogTotalB
      alerts.push({
        id: `${ticker}-${latest.periodLabel}-backlog-yoy-decline`,
        ticker,
        periodLabel: latest.periodLabel,
        severity: 'warning',
        rule: 'backlog_yoy_decline',
        message: `${ticker} backlog declined ${Math.abs(delta).toFixed(1)}B YoY in ${latest.periodLabel}.`,
        sourceUrl: sourceFromRow(latest) ?? sourceFromRow(yearAgo),
      })
    }

    alerts.push(...buildDisclosureGapMessages({ticker, latest}))
  }

  return alerts.sort((left, right) => {
    const severityOrder = {
      critical: 3,
      warning: 2,
      info: 1,
    }

    const severityDiff = severityOrder[right.severity] - severityOrder[left.severity]

    if (severityDiff !== 0) {
      return severityDiff
    }

    return left.ticker.localeCompare(right.ticker)
  })
}
