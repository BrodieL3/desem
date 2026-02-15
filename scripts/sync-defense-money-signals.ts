import {syncDefenseMoneySignals} from '../lib/data/signals/sync'

type CliOptions = {
  targetDate?: string
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--target-date' && argv[index + 1]) {
      options.targetDate = compact(argv[index + 1])
      index += 1
      continue
    }

    if (arg === '--help') {
      console.log(`\nSync defense money signals (DoD spend + market moves + briefs).\n\nUsage:\n  bun run scripts/sync-defense-money-signals.ts [flags]\n\nFlags:\n  --target-date <YYYY-MM-DD>    Optional override for daily spend window\n  --help                        Show this help\n`)
      process.exit(0)
    }
  }

  return options
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const result = await syncDefenseMoneySignals({
    targetDate: options.targetDate,
    triggerSource: 'script:sync-defense-money-signals',
  })

  console.log(`Run: ${result.runId ?? 'n/a'}`)
  console.log(`Status: ${result.status}`)
  console.log(`Target date: ${result.targetDate}`)
  console.log(`Transactions: ${result.processedTransactions}`)
  console.log(`Tickers: ${result.processedTickers}`)
  console.log(`Briefs: ${result.processedBriefs}`)

  if (result.warnings.length > 0) {
    console.log('Warnings:')
    for (const warning of result.warnings) {
      console.log(`- ${warning}`)
    }
  }

  if (result.error) {
    throw new Error(result.error)
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
