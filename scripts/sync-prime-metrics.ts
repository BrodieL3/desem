import {syncPrimeMetricsFromSec} from '../lib/data/primes/sync'

type CliOptions = {
  filingsPerCompany: number
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    filingsPerCompany: 1,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--filings-per-company' && argv[index + 1]) {
      const parsed = Number.parseInt(argv[index + 1] ?? '', 10)
      options.filingsPerCompany = Number.isFinite(parsed) ? parsed : 1
      index += 1
      continue
    }

    if (arg === '--help') {
      console.log(`\nSync latest prime metrics from SEC submissions.\n\nUsage:\n  bun run scripts/sync-prime-metrics.ts [flags]\n\nFlags:\n  --filings-per-company <n>   Candidate filings to evaluate per ticker (default: 1)\n  --help                      Show this help\n`)
      process.exit(0)
    }
  }

  return options
}

async function run() {
  const options = parseArgs(process.argv.slice(2))

  const result = await syncPrimeMetricsFromSec({
    filingsPerCompany: options.filingsPerCompany,
  })

  console.log(`Run: ${result.runId ?? 'n/a'}`)
  console.log(`Processed companies: ${result.processedCompanies}`)
  console.log(`Processed periods: ${result.processedPeriods}`)

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
