import type {DefenseMoneyMarketQuote} from '../types'

type FinnhubQuoteResponse = {
  c?: number
  h?: number
  l?: number
  o?: number
  pc?: number
  t?: number
}

type FinnhubNewsItem = {
  headline?: string
  url?: string
  datetime?: number
}

type FinnhubCandleResponse = {
  c?: number[]
  h?: number[]
  l?: number[]
  o?: number[]
  t?: number[]
  s?: string
}

type FetchFinnhubQuotesOptions = {
  tickers: string[]
  apiKey: string
}

function toIsoDateFromUnixSeconds(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return null
  }

  return new Date((value as number) * 1000).toISOString().slice(0, 10)
}

function toNumber(value: unknown) {
  if (typeof value !== 'number') {
    return null
  }

  return Number.isFinite(value) ? value : null
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function quoteUrl(symbol: string) {
  return `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`
}

function companyNewsUrl(symbol: string, from: string, to: string) {
  return `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
}

function candlesUrl(symbol: string, fromUnix: number, toUnix: number) {
  return `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${fromUnix}&to=${toUnix}`
}

export async function fetchFinnhubDailyQuotes(options: FetchFinnhubQuotesOptions) {
  const warnings: string[] = []
  const quotes: DefenseMoneyMarketQuote[] = []

  if (!options.apiKey) {
    return {
      quotes,
      warnings: ['FINNHUB_API_KEY is missing; market quotes were skipped.'],
    }
  }

  const toDate = new Date().toISOString().slice(0, 10)
  const fromDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  for (const ticker of options.tickers) {
    try {
      const [quoteResponse, newsResponse] = await Promise.all([
        fetch(`${quoteUrl(ticker)}&token=${encodeURIComponent(options.apiKey)}`),
        fetch(`${companyNewsUrl(ticker, fromDate, toDate)}&token=${encodeURIComponent(options.apiKey)}`),
      ])

      if (!quoteResponse.ok) {
        warnings.push(`Finnhub quote request failed for ${ticker} (${quoteResponse.status}).`)
        continue
      }

      const quoteJson = (await quoteResponse.json()) as FinnhubQuoteResponse
      const newsJson = newsResponse.ok ? ((await newsResponse.json()) as FinnhubNewsItem[]) : []
      const latestNews = (newsJson ?? []).find((item) => compact(item.headline) && compact(item.url))

      const previousClose = toNumber(quoteJson.pc)
      const currentPrice = toNumber(quoteJson.c)

      const changeNum = currentPrice !== null && previousClose !== null ? Number((currentPrice - previousClose).toFixed(4)) : null
      const changePercent =
        changeNum !== null && previousClose && previousClose !== 0 ? Number(((changeNum / previousClose) * 100).toFixed(4)) : null

      quotes.push({
        ticker,
        tradeDate: toIsoDateFromUnixSeconds(quoteJson.t) ?? toDate,
        price: currentPrice,
        changeNum,
        changePercent,
        high: toNumber(quoteJson.h),
        low: toNumber(quoteJson.l),
        open: toNumber(quoteJson.o),
        previousClose,
        sourceUrl: `https://finnhub.io/quote/${encodeURIComponent(ticker)}`,
        contextHeadline: compact(latestNews?.headline) || null,
        contextUrl: compact(latestNews?.url) || null,
        rawPayload: {
          quote: quoteJson,
          news: latestNews ?? null,
        },
      })
    } catch (error) {
      warnings.push(`${ticker}: ${error instanceof Error ? error.message : 'Unknown Finnhub fetch failure.'}`)
    }
  }

  return {
    quotes,
    warnings,
  }
}

export async function fetchFinnhubHistoricalCandles(input: {
  ticker: string
  apiKey: string
  fromDate: string
  toDate: string
}) {
  if (!input.apiKey) {
    return []
  }

  const fromUnix = Math.floor(new Date(`${input.fromDate}T00:00:00Z`).getTime() / 1000)
  const toUnix = Math.floor(new Date(`${input.toDate}T23:59:59Z`).getTime() / 1000)
  const response = await fetch(`${candlesUrl(input.ticker, fromUnix, toUnix)}&token=${encodeURIComponent(input.apiKey)}`)

  if (!response.ok) {
    throw new Error(`Finnhub candle request failed for ${input.ticker} (${response.status}).`)
  }

  const payload = (await response.json()) as FinnhubCandleResponse

  if (payload.s !== 'ok') {
    return []
  }

  const prices = payload.c ?? []
  const opens = payload.o ?? []
  const highs = payload.h ?? []
  const lows = payload.l ?? []
  const timestamps = payload.t ?? []

  const rows: DefenseMoneyMarketQuote[] = []

  for (let index = 0; index < timestamps.length; index += 1) {
    const tradeDate = toIsoDateFromUnixSeconds(timestamps[index])

    if (!tradeDate) {
      continue
    }

    const price = toNumber(prices[index])
    const open = toNumber(opens[index])
    const high = toNumber(highs[index])
    const low = toNumber(lows[index])

    rows.push({
      ticker: input.ticker,
      tradeDate,
      price,
      changeNum: null,
      changePercent: null,
      high,
      low,
      open,
      previousClose: null,
      sourceUrl: `https://finnhub.io/quote/${encodeURIComponent(input.ticker)}`,
      contextHeadline: null,
      contextUrl: null,
      rawPayload: {
        c: price,
        o: open,
        h: high,
        l: low,
        t: timestamps[index],
      },
    })
  }

  return rows
}
