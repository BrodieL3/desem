import {rebuildDefenseMoneyRollups} from '../lib/data/signals/sync'
import {priorBusinessDayEt} from '../lib/data/signals/time'

type CliOptions = {
  targetDate: string
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    targetDate: priorBusinessDayEt(),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--target-date' && argv[index + 1]) {
      options.targetDate = compact(argv[index + 1]) || options.targetDate
      index += 1
      continue
    }

    if (arg === '--help') {
      console.log(`\nRebuild weekly and monthly defense-money rollups from stored daily transactions.\n\nUsage:\n  bun run scripts/rebuild-defense-money-rollups.ts [flags]\n\nFlags:\n  --target-date <YYYY-MM-DD>    Anchor date for trailing window (default: prior business day ET)\n  --help                        Show this help\n`)
      process.exit(0)
    }
  }

  return options
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const result = await rebuildDefenseMoneyRollups(options.targetDate)

  console.log(`Rollups rebuilt.`)
  console.log(`Rows upserted: ${result.count}`)
  console.log(`Weekly rows: ${result.weeklyCount}`)
  console.log(`Monthly rows: ${result.monthlyCount}`)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
