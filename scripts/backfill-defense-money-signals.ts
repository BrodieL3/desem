import {createSupabaseAdminClientFromEnv} from '../lib/supabase/admin'
import {priorBusinessDayEt, shiftIsoDate} from '../lib/data/signals/time'
import {backfillUsaspendingTransactions, rebuildDefenseMoneyRollups} from '../lib/data/signals/sync'

type CliOptions = {
  startDate?: string
  endDate?: string
  months: number
  chunkDays: number
  checkpointKey: string
  skipRollups: boolean
}

type CheckpointRow = {
  checkpoint_key: string
  cursor_date: string | null
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    months: 24,
    chunkDays: 30,
    checkpointKey: 'defense-money-awards-bulk',
    skipRollups: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--start' && argv[index + 1]) {
      options.startDate = compact(argv[index + 1])
      index += 1
      continue
    }

    if (arg === '--end' && argv[index + 1]) {
      options.endDate = compact(argv[index + 1])
      index += 1
      continue
    }

    if (arg === '--months' && argv[index + 1]) {
      const parsed = Number.parseInt(argv[index + 1] ?? '', 10)
      options.months = Number.isFinite(parsed) ? Math.max(1, parsed) : 24
      index += 1
      continue
    }

    if (arg === '--chunk-days' && argv[index + 1]) {
      const parsed = Number.parseInt(argv[index + 1] ?? '', 10)
      options.chunkDays = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 90)) : 30
      index += 1
      continue
    }

    if (arg === '--checkpoint-key' && argv[index + 1]) {
      options.checkpointKey = compact(argv[index + 1]) || options.checkpointKey
      index += 1
      continue
    }

    if (arg === '--skip-rollups') {
      options.skipRollups = true
      continue
    }

    if (arg === '--help') {
      console.log(`\nBackfill defense money transactions from USAspending in bulk date-range chunks.\n\nUsage:\n  bun run scripts/backfill-defense-money-signals.ts [flags]\n\nFlags:\n  --start <YYYY-MM-DD>          Optional explicit start date\n  --end <YYYY-MM-DD>            Optional explicit end date (default: prior business day)\n  --months <n>                  Backfill window when --start omitted (default: 24)\n  --chunk-days <n>              Days per API chunk (default: 30, max: 90)\n  --checkpoint-key <key>        Resume key in defense_money_backfill_checkpoints\n  --skip-rollups                Skip rollup rebuild after backfill\n  --help                        Show this help\n`)
      process.exit(0)
    }
  }

  return options
}

async function readCheckpoint(input: {checkpointKey: string}) {
  const supabase = createSupabaseAdminClientFromEnv()
  const {data, error} = await supabase
    .from('defense_money_backfill_checkpoints')
    .select('checkpoint_key, cursor_date')
    .eq('checkpoint_key', input.checkpointKey)
    .maybeSingle<CheckpointRow>()

  if (error) {
    throw new Error(`Unable to read checkpoint ${input.checkpointKey}: ${error.message}`)
  }

  return data?.cursor_date ?? null
}

async function writeCheckpoint(input: {
  checkpointKey: string
  cursorDate: string
  payload: Record<string, unknown>
}) {
  const supabase = createSupabaseAdminClientFromEnv()

  const {error} = await supabase.from('defense_money_backfill_checkpoints').upsert(
    {
      checkpoint_key: input.checkpointKey,
      cursor_date: input.cursorDate,
      cursor_page: 1,
      payload: input.payload,
    },
    {
      onConflict: 'checkpoint_key',
    }
  )

  if (error) {
    throw new Error(`Unable to write checkpoint ${input.checkpointKey}: ${error.message}`)
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2))

  const endDate = options.endDate || priorBusinessDayEt()
  let startDate = options.startDate || shiftIsoDate(endDate, -(options.months * 30))

  const checkpoint = await readCheckpoint({checkpointKey: options.checkpointKey})

  if (checkpoint && checkpoint >= startDate && checkpoint < endDate) {
    startDate = shiftIsoDate(checkpoint, 1)
    console.log(`Resuming from checkpoint: ${checkpoint}`)
  }

  console.log(`Backfill range: ${startDate} -> ${endDate} (${options.chunkDays}-day chunks)`)
  console.log(`Checkpoint key: ${options.checkpointKey}`)

  const result = await backfillUsaspendingTransactions({
    startDate,
    endDate,
    chunkDays: options.chunkDays,
    maxPagesPerChunk: 200,
    onChunk: async (chunk) => {
      const rate = chunk.elapsed > 0 ? ((chunk.transactions / chunk.elapsed) * 1000).toFixed(0) : '?'

      if (chunk.error) {
        console.error(`  ${chunk.startDate}..${chunk.endDate}: ERROR ${chunk.error}`)
      } else {
        console.log(`  ${chunk.startDate}..${chunk.endDate}: ${chunk.transactions} tx (${(chunk.elapsed / 1000).toFixed(1)}s, ${rate} tx/s)`)
      }

      await writeCheckpoint({
        checkpointKey: options.checkpointKey,
        cursorDate: chunk.endDate,
        payload: {transactions: chunk.transactions, error: chunk.error},
      })
    },
  })

  console.log(`\nBackfill complete: ${result.totalTransactions} transactions across ${result.chunks} chunks`)

  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`)
    for (const warning of result.warnings.slice(0, 10)) {
      console.log(`  - ${warning}`)
    }
  }

  if (!options.skipRollups) {
    console.log('\nRebuilding rollups...')
    const rollupResult = await rebuildDefenseMoneyRollups(endDate)
    console.log(`Rollups rebuilt: ${rollupResult.weeklyCount} weekly, ${rollupResult.monthlyCount} monthly`)
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
