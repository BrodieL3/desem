import type {
  PrimeAlert,
  PrimeCompanyDescriptor,
  PrimeDisclosureStatus,
  PrimeMetricKey,
  PrimeSeriesPoint,
  PrimeSourceCitation,
  PrimeTableRow,
} from '@/lib/data/primes/types'

export type DataModuleHeader = {
  eyebrow?: string
  title: string
  description?: string
}

export type PrimeAlertsPanelProps = {
  alerts: PrimeAlert[]
}

export type PrimeMetricChartCardProps = {
  title: string
  description?: string
  metricKey: PrimeMetricKey
  companies: PrimeCompanyDescriptor[]
  points: PrimeSeriesPoint[]
  formatter?: (value: number | null) => string
  yReference?: number
  yReferenceLabel?: string
  emptyLabel?: string
}

export type PrimeBacklogComparisonChartProps = {
  companies: PrimeCompanyDescriptor[]
  points: PrimeSeriesPoint[]
}

export type PrimeBookToBillTrendChartProps = {
  companies: PrimeCompanyDescriptor[]
  points: PrimeSeriesPoint[]
}

export type PrimeMetricsTableProps = {
  rows: PrimeTableRow[]
  companies: PrimeCompanyDescriptor[]
}

export type PrimeSourcesDrawerProps = {
  sources: PrimeSourceCitation[]
}

export type DisclosureBadgeProps = {
  status: PrimeDisclosureStatus
}
