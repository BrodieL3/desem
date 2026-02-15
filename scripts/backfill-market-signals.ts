import {backfillDefenseMoneyMarketSignals} from '../lib/data/signals/sync'

type CliOptions = {
  days: number
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    days: 31,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--days' && argv[index + 1]) {
      const parsed = Number.parseInt(argv[index + 1] ?? '', 10)
      options.days = Number.isFinite(parsed) ? Math.max(1, parsed) : 31
      index += 1
      continue
    }

    if (arg === '--help') {
      console.log(`\nBackfill one-month market signals for configured defense tickers.\n\nUsage:\n  bun run scripts/backfill-market-signals.ts [flags]\n\nFlags:\n  --days <n>   Number of trailing calendar days (default: 31)\n  --help       Show this help\n`)
      process.exit(0)
    }
  }

  return options
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const result = await backfillDefenseMoneyMarketSignals({
    days: options.days,
  })

  console.log(`Market backfill complete.`)
  console.log(`Range: ${result.fromDate} -> ${result.toDate}`)
  console.log(`Stored rows: ${result.storedRows}`)

  if (result.warnings.length > 0) {
    console.log('Warnings:')
    for (const warning of result.warnings) {
      console.log(`- ${warning}`)
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
