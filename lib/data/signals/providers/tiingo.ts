import type {DefenseMoneyMarketQuote} from '../types'

type TiingoEodPoint = {
  date: string
  close: number
  high: number
  low: number
  open: number
  volume: number
  adjClose?: number
  adjHigh?: number
  adjLow?: number
  adjOpen?: number
  adjVolume?: number
}

function toNumber(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null
  }

  return Number.isFinite(value) ? value : null
}

function toIsoDate(value: string): string {
  return value.slice(0, 10)
}

export type FetchTiingoHistoricalOptions = {
  ticker: string
  apiKey: string
  startDate: string
  endDate: string
}

export async function fetchTiingoHistoricalEod(
  options: FetchTiingoHistoricalOptions,
): Promise<{quotes: DefenseMoneyMarketQuote[]; warnings: string[]}> {
  const warnings: string[] = []

  if (!options.apiKey) {
    return {quotes: [], warnings: ['TIINGO_API_KEY is missing; historical quotes skipped.']}
  }

  const url = `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(options.ticker)}/prices?startDate=${encodeURIComponent(options.startDate)}&endDate=${encodeURIComponent(options.endDate)}&token=${encodeURIComponent(options.apiKey)}`

  let response: Response | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok || response.status < 500) {
        break
      }
    } catch {
      // transient network error
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)))
      response = null
    }
  }

  if (!response || !response.ok) {
    const status = response?.status ?? 'network error'
    warnings.push(`Tiingo historical request failed for ${options.ticker} (${status}).`)
    return {quotes: [], warnings}
  }

  const points = (await response.json()) as TiingoEodPoint[]

  if (!Array.isArray(points) || points.length === 0) {
    return {quotes: [], warnings}
  }

  const quotes: DefenseMoneyMarketQuote[] = []

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]!
    const tradeDate = toIsoDate(point.date)
    const price = toNumber(point.close)
    const open = toNumber(point.open)
    const high = toNumber(point.high)
    const low = toNumber(point.low)

    const previousPoint = i > 0 ? points[i - 1] : undefined
    const previousClose = previousPoint ? toNumber(previousPoint.close) : null

    const changeNum =
      price !== null && previousClose !== null ? Number((price - previousClose).toFixed(4)) : null

    const changePercent =
      changeNum !== null && previousClose && previousClose !== 0
        ? Number(((changeNum / previousClose) * 100).toFixed(4))
        : null

    quotes.push({
      ticker: options.ticker,
      tradeDate,
      price,
      changeNum,
      changePercent,
      high,
      low,
      open,
      previousClose,
      sourceUrl: `https://www.tiingo.com/quote/${encodeURIComponent(options.ticker)}`,
      contextHeadline: null,
      contextUrl: null,
      rawPayload: point as unknown as Record<string, unknown>,
    })
  }

  return {quotes, warnings}
}
