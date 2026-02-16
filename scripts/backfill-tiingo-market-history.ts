import {createSupabaseAdminClientFromEnv} from '../lib/supabase/admin'
import {getDefenseMoneySignalsConfig} from '../lib/data/signals/config'
import {fetchTiingoHistoricalEod} from '../lib/data/signals/providers/tiingo'
import type {DefenseMoneyMarketQuote} from '../lib/data/signals/types'

type CliOptions = {
  years: number
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {years: 3}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--years' && argv[index + 1]) {
      const parsed = Number.parseInt(argv[index + 1] ?? '', 10)
      options.years = Number.isFinite(parsed) ? Math.max(1, parsed) : 3
      index += 1
      continue
    }

    if (arg === '--help') {
      console.log(`
Backfill market history from Tiingo for defense prime tickers.

Usage:
  bun run scripts/backfill-tiingo-market-history.ts [flags]

Flags:
  --years <n>   Years of history to pull (default: 3)
  --help        Show this help
`)
      process.exit(0)
    }
  }

  return options
}

async function upsertQuotes(quotes: DefenseMoneyMarketQuote[]) {
  if (quotes.length === 0) {
    return 0
  }

  const supabase = createSupabaseAdminClientFromEnv()

  const payload = quotes.map((row) => ({
    run_id: null,
    trade_date: row.tradeDate,
    ticker: row.ticker,
    price: row.price,
    change_num: row.changeNum,
    change_percent: row.changePercent,
    high: row.high,
    low: row.low,
    open: row.open,
    previous_close: row.previousClose,
    source_url: row.sourceUrl,
    context_headline: row.contextHeadline,
    context_url: row.contextUrl,
    raw_payload: row.rawPayload ?? {},
  }))

  // Upsert in batches of 500 to avoid payload limits
  let stored = 0

  for (let i = 0; i < payload.length; i += 500) {
    const batch = payload.slice(i, i + 500)
    const {error} = await supabase.from('defense_money_market_quotes').upsert(batch, {
      onConflict: 'trade_date,ticker',
    })

    if (error) {
      throw new Error(`Upsert failed at batch ${i}: ${error.message}`)
    }

    stored += batch.length
  }

  return stored
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const config = getDefenseMoneySignalsConfig()
  const apiKey = config.tiingoApiKey

  if (!apiKey) {
    console.error('TIINGO_API_KEY is required. Set it in .env.local or environment.')
    process.exit(1)
  }

  const endDate = new Date().toISOString().slice(0, 10)
  const startDate = new Date()
  startDate.setFullYear(startDate.getFullYear() - options.years)
  const startDateIso = startDate.toISOString().slice(0, 10)

  console.log(`Backfill range: ${startDateIso} -> ${endDate}`)
  console.log(`Tickers: ${config.marketTickers.join(', ')}`)

  let totalStored = 0
  const allWarnings: string[] = []

  for (const ticker of config.marketTickers) {
    console.log(`Fetching ${ticker}...`)

    const {quotes, warnings} = await fetchTiingoHistoricalEod({
      ticker,
      apiKey,
      startDate: startDateIso,
      endDate,
    })

    allWarnings.push(...warnings)

    if (quotes.length === 0) {
      console.log(`  ${ticker}: 0 data points`)
      continue
    }

    const stored = await upsertQuotes(quotes)
    totalStored += stored
    console.log(`  ${ticker}: ${stored} data points stored`)

    // Rate limit: 50 symbols/hour = at least 72s between calls
    // Use 5s since we only have 6 tickers
    if (config.marketTickers.indexOf(ticker) < config.marketTickers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }

  console.log(`\nBackfill complete.`)
  console.log(`Total rows stored: ${totalStored}`)

  if (allWarnings.length > 0) {
    console.log('Warnings:')

    for (const warning of allWarnings) {
      console.log(`- ${warning}`)
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
