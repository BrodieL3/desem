import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'

import {upsertPrimeBackfillDocument} from '../lib/data/primes/backfill'
import type {PrimeBackfillDocument} from '../lib/data/primes/types'
import {createSupabaseAdminClientFromEnv} from '../lib/supabase/admin'

type CliOptions = {
  inputPath: string
}

function parseArgs(argv: string[]): CliOptions {
  const defaults: CliOptions = {
    inputPath: resolve(process.cwd(), 'scripts/data/prime-metrics.backfill.json'),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--input' && argv[index + 1]) {
      defaults.inputPath = resolve(process.cwd(), argv[index + 1] ?? '')
      index += 1
      continue
    }

    if (arg === '--help') {
      console.log(`\nBackfill prime metrics from curated JSON.\n\nUsage:\n  bun run scripts/backfill-prime-metrics.ts [flags]\n\nFlags:\n  --input <path>    Path to JSON artifact (default: scripts/data/prime-metrics.backfill.json)\n  --help            Show this help\n`)
      process.exit(0)
    }
  }

  return defaults
}

async function loadBackfillDocument(path: string): Promise<PrimeBackfillDocument> {
  const contents = await readFile(path, 'utf8')
  return JSON.parse(contents) as PrimeBackfillDocument
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const supabase = createSupabaseAdminClientFromEnv()

  const document = await loadBackfillDocument(options.inputPath)
  const result = await upsertPrimeBackfillDocument(supabase, document)

  console.log(`Backfill complete.`)
  console.log(`Companies: ${result.companyCount}`)
  console.log(`Periods: ${result.periodCount}`)
  console.log(`Metric points: ${result.metricPointCount}`)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
