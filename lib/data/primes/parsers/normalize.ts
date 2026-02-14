import type {PrimeMetricKey} from '../types'

function toNumber(value: string) {
  const normalized = value.replace(/[$,]/g, '').trim()
  const parsed = Number.parseFloat(normalized)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

export function parseAmountToBillions(rawValue: string): number | null {
  const compact = rawValue.replace(/\s+/g, ' ').trim()

  if (!compact) {
    return null
  }

  const unitMatch = compact.match(/(trillion|billion|million|tn|bn|mm|m)\b/i)
  const numericMatch = compact.match(/-?\$?\s*([0-9]+(?:\.[0-9]+)?)/)

  if (!numericMatch) {
    return null
  }

  const numeric = toNumber(numericMatch[1] ?? '')

  if (numeric === null) {
    return null
  }

  const unit = unitMatch?.[1]?.toLowerCase() ?? 'billion'

  if (unit === 'trillion' || unit === 'tn') {
    return Number((numeric * 1000).toFixed(3))
  }

  if (unit === 'million' || unit === 'mm' || unit === 'm') {
    return Number((numeric / 1000).toFixed(3))
  }

  return Number(numeric.toFixed(3))
}

export function parseRatio(rawValue: string): number | null {
  const numericMatch = rawValue.match(/-?([0-9]+(?:\.[0-9]+)?)/)

  if (!numericMatch) {
    return null
  }

  const parsed = toNumber(numericMatch[1] ?? '')

  if (parsed === null) {
    return null
  }

  return Number(parsed.toFixed(3))
}

export function toPeriodLabel(input: {fiscalYear: number; fiscalQuarter: number}) {
  return `Q${input.fiscalQuarter} ${input.fiscalYear}`
}

export function metricUnit(metricKey: PrimeMetricKey) {
  if (metricKey === 'book_to_bill') {
    return 'ratio'
  }

  return 'usd_billion'
}
