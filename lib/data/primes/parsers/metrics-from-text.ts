import type {PrimeDisclosureStatus, PrimeMetricKey} from '../types'

import {parseAmountToBillions, parseRatio} from './normalize'

export type ParsedMetric = {
  value: number | null
  status: PrimeDisclosureStatus
  sourceNote: string
}

export type ParsedMetricSet = Partial<Record<PrimeMetricKey, ParsedMetric>>

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function parseBacklog(text: string): ParsedMetric {
  const patterns = [
    /backlog(?:\s+of|\s+was|\s+at|\s+ended)?\s+\$?\s*([0-9]+(?:\.[0-9]+)?)\s*(trillion|billion|million|tn|bn|mm|m)?/i,
    /total backlog[^$]*\$\s*([0-9]+(?:\.[0-9]+)?)\s*(trillion|billion|million|tn|bn|mm|m)?/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)

    if (!match) {
      continue
    }

    const unit = match[2] ? ` ${match[2]}` : ' billion'
    const value = parseAmountToBillions(`${match[1]}${unit}`)

    if (value !== null) {
      return {
        value,
        status: 'disclosed',
        sourceNote: normalizeWhitespace(match[0]),
      }
    }
  }

  return {
    value: null,
    status: 'not_disclosed',
    sourceNote: 'Backlog not explicitly disclosed.',
  }
}

function parseBookToBill(text: string): ParsedMetric {
  const match = text.match(/book[-\s]?to[-\s]?bill(?:\s+ratio)?(?:\s+(?:of|was|is|at))?\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)/i)

  if (!match) {
    return {
      value: null,
      status: 'not_disclosed',
      sourceNote: 'Book-to-bill not explicitly disclosed.',
    }
  }

  return {
    value: parseRatio(match[1] ?? ''),
    status: 'disclosed',
    sourceNote: normalizeWhitespace(match[0]),
  }
}

function parseRevenue(text: string): ParsedMetric {
  const patterns = [
    /(?:revenue|sales)(?:\s+(?:of|was|were|totaled|totalled|reached))?\s+\$?\s*([0-9]+(?:\.[0-9]+)?)\s*(trillion|billion|million|tn|bn|mm|m)?/i,
    /(?:quarterly revenue|net sales)\s+of\s+\$?\s*([0-9]+(?:\.[0-9]+)?)\s*(trillion|billion|million|tn|bn|mm|m)?/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)

    if (!match) {
      continue
    }

    const unit = match[2] ? ` ${match[2]}` : ' billion'

    return {
      value: parseAmountToBillions(`${match[1]}${unit}`),
      status: 'disclosed',
      sourceNote: normalizeWhitespace(match[0]),
    }
  }

  return {
    value: null,
    status: 'not_disclosed',
    sourceNote: 'Revenue metric not explicitly disclosed in parseable form.',
  }
}

function parseOrders(text: string): ParsedMetric {
  const patterns = [
    /(?:orders|bookings|awards)(?:\s+(?:of|were|was|totaled|totalled|reached))?\s+\$?\s*([0-9]+(?:\.[0-9]+)?)\s*(trillion|billion|million|tn|bn|mm|m)?/i,
    /new awards[^$]*\$\s*([0-9]+(?:\.[0-9]+)?)\s*(trillion|billion|million|tn|bn|mm|m)?/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)

    if (!match) {
      continue
    }

    const unit = match[2] ? ` ${match[2]}` : ' billion'

    return {
      value: parseAmountToBillions(`${match[1]}${unit}`),
      status: 'disclosed',
      sourceNote: normalizeWhitespace(match[0]),
    }
  }

  return {
    value: null,
    status: 'not_disclosed',
    sourceNote: 'Orders/bookings metric not explicitly disclosed.',
  }
}

export function parsePrimeMetricsFromText(sourceText: string): ParsedMetricSet {
  const text = normalizeWhitespace(sourceText)

  if (!text) {
    return {
      backlog_total_b: {
        value: null,
        status: 'not_disclosed',
        sourceNote: 'Empty source text.',
      },
      book_to_bill: {
        value: null,
        status: 'not_disclosed',
        sourceNote: 'Empty source text.',
      },
      revenue_b: {
        value: null,
        status: 'not_disclosed',
        sourceNote: 'Empty source text.',
      },
      orders_b: {
        value: null,
        status: 'not_disclosed',
        sourceNote: 'Empty source text.',
      },
    }
  }

  return {
    backlog_total_b: parseBacklog(text),
    book_to_bill: parseBookToBill(text),
    revenue_b: parseRevenue(text),
    orders_b: parseOrders(text),
  }
}
