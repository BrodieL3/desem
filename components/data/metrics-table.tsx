'use client'

import Link from 'next/link'
import {useMemo, useState} from 'react'

import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'

import type {PrimeMetricsTableProps} from './types'

type SortKey = 'periodEnd' | 'ticker' | 'backlogTotalB' | 'bookToBill' | 'revenueB' | 'ordersB'
type SortDirection = 'asc' | 'desc'

const metricColumns = [
  {
    key: 'backlogTotalB',
    label: 'Backlog ($B)',
  },
  {
    key: 'bookToBill',
    label: 'Book-to-bill',
  },
  {
    key: 'revenueB',
    label: 'Revenue ($B)',
  },
  {
    key: 'ordersB',
    label: 'Orders ($B)',
  },
] as const

function numberOrNull(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return null
  }

  return value
}

function metricCell(value: number | null, precision = 2) {
  const resolved = numberOrNull(value)

  if (resolved === null) {
    return <Badge variant="secondary">Not disclosed</Badge>
  }

  return resolved.toLocaleString(undefined, {
    maximumFractionDigits: precision,
    minimumFractionDigits: precision > 0 ? 1 : 0,
  })
}

export function MetricsTable({rows, companies}: PrimeMetricsTableProps) {
  const [selectedTicker, setSelectedTicker] = useState<'ALL' | string>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('periodEnd')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [visibleColumns, setVisibleColumns] = useState<Record<(typeof metricColumns)[number]['key'], boolean>>({
    backlogTotalB: true,
    bookToBill: true,
    revenueB: true,
    ordersB: true,
  })

  const filteredRows = useMemo(() => {
    const base = selectedTicker === 'ALL' ? rows : rows.filter((row) => row.ticker === selectedTicker)

    return [...base].sort((left, right) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1

      if (sortKey === 'periodEnd') {
        return multiplier * (Date.parse(left.periodEnd) - Date.parse(right.periodEnd))
      }

      if (sortKey === 'ticker') {
        return multiplier * left.ticker.localeCompare(right.ticker)
      }

      const leftValue = left[sortKey]
      const rightValue = right[sortKey]

      if (leftValue === null && rightValue === null) {
        return 0
      }

      if (leftValue === null) {
        return 1
      }

      if (rightValue === null) {
        return -1
      }

      return multiplier * (leftValue - rightValue)
    })
  }, [rows, selectedTicker, sortDirection, sortKey])

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === 'periodEnd' ? 'desc' : 'asc')
  }

  function toggleColumn(key: (typeof metricColumns)[number]['key']) {
    setVisibleColumns((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="space-y-3">
        <CardTitle className="font-display text-[1.9rem] leading-tight">Quarterly metric table</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="prime-company-filter" className="text-muted-foreground text-xs tracking-wide uppercase">
            Company
          </label>
          <select
            id="prime-company-filter"
            className="h-11 rounded-md border border-border bg-background px-3 text-sm"
            value={selectedTicker}
            onChange={(event) => setSelectedTicker(event.target.value)}
          >
            <option value="ALL">All primes</option>
            {companies.map((company) => (
              <option key={company.ticker} value={company.ticker}>
                {company.name} ({company.ticker})
              </option>
            ))}
          </select>

          <Button type="button" variant="outline" size="sm" onClick={() => toggleSort('periodEnd')}>
            Sort by period
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => toggleSort('ticker')}>
            Sort by ticker
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {metricColumns.map((column) => (
            <Button
              key={column.key}
              type="button"
              variant={visibleColumns[column.key] ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => toggleColumn(column.key)}
              aria-pressed={visibleColumns[column.key]}
            >
              {visibleColumns[column.key] ? 'Hide' : 'Show'} {column.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="overflow-x-auto">
        {filteredRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No rows available for the selected filter.</p>
        ) : (
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-2 py-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort('periodEnd')}>
                    Period
                  </Button>
                </th>
                <th className="px-2 py-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort('ticker')}>
                    Company
                  </Button>
                </th>
                {visibleColumns.backlogTotalB ? (
                  <th className="px-2 py-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort('backlogTotalB')}>
                      Backlog ($B)
                    </Button>
                  </th>
                ) : null}
                {visibleColumns.bookToBill ? (
                  <th className="px-2 py-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort('bookToBill')}>
                      Book-to-bill
                    </Button>
                  </th>
                ) : null}
                {visibleColumns.revenueB ? (
                  <th className="px-2 py-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort('revenueB')}>
                      Revenue ($B)
                    </Button>
                  </th>
                ) : null}
                {visibleColumns.ordersB ? (
                  <th className="px-2 py-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort('ordersB')}>
                      Orders ($B)
                    </Button>
                  </th>
                ) : null}
                <th className="px-2 py-2">Sources</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={`${row.ticker}-${row.periodEnd}`} className="border-b border-border/60 align-top">
                  <td className="px-2 py-3 whitespace-nowrap">{row.periodLabel}</td>
                  <td className="px-2 py-3 whitespace-nowrap">{row.companyName}</td>
                  {visibleColumns.backlogTotalB ? <td className="px-2 py-3">{metricCell(row.backlogTotalB)}</td> : null}
                  {visibleColumns.bookToBill ? <td className="px-2 py-3">{metricCell(row.bookToBill)}</td> : null}
                  {visibleColumns.revenueB ? <td className="px-2 py-3">{metricCell(row.revenueB)}</td> : null}
                  {visibleColumns.ordersB ? <td className="px-2 py-3">{metricCell(row.ordersB)}</td> : null}
                  <td className="px-2 py-3">
                    <div className="space-y-1">
                      {row.sourceLinks.length === 0 ? (
                        <span className="text-muted-foreground">N/D</span>
                      ) : (
                        row.sourceLinks.slice(0, 2).map((link) => (
                          <p key={link}>
                            <Link
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              Source
                            </Link>
                          </p>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
