'use client'

import {MetricChartCard} from './metric-chart-card'
import type {PrimeBookToBillTrendChartProps} from './types'

function formatRatio(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return 'N/D'
  }

  return value.toFixed(2)
}

export function BookToBillTrendChart({companies, points}: PrimeBookToBillTrendChartProps) {
  return (
    <MetricChartCard
      title="Book-to-bill trend"
      description="Trailing quarterly book-to-bill ratio by prime."
      metricKey="book_to_bill"
      companies={companies}
      points={points}
      formatter={formatRatio}
      yReference={1}
      yReferenceLabel="1.0 threshold"
      emptyLabel="Book-to-bill history is not available yet."
    />
  )
}
