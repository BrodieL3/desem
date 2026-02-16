import {createSupabaseAdminClientFromEnv} from '../lib/supabase/admin'
import {priorBusinessDayEt, shiftIsoDate} from '../lib/data/signals/time'
import {syncDefenseMoneySignals} from '../lib/data/signals/sync'

type CliOptions = {
  startDate?: string
  endDate?: string
  months: number
  checkpointKey: string
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
    checkpointKey: 'defense-money-awards-24m',
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

    if (arg === '--checkpoint-key' && argv[index + 1]) {
      options.checkpointKey = compact(argv[index + 1]) || options.checkpointKey
      index += 1
      continue
    }

    if (arg === '--help') {
      console.log(`\nBackfill defense money signals from USAspending by business day.\n\nUsage:\n  bun run scripts/backfill-defense-money-signals.ts [flags]\n\nFlags:\n  --start <YYYY-MM-DD>          Optional explicit start date\n  --end <YYYY-MM-DD>            Optional explicit end date\n  --months <n>                  Backfill window when --start omitted (default: 24)\n  --checkpoint-key <key>        Resume key in defense_money_backfill_checkpoints\n  --help                        Show this help\n`)
      process.exit(0)
    }
  }

  return options
}

function isWeekend(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`)
  const day = parsed.getUTCDay()
  return day === 0 || day === 6
}

function nextBusinessDate(value: string) {
  let cursor = shiftIsoDate(value, 1)

  while (isWeekend(cursor)) {
    cursor = shiftIsoDate(cursor, 1)
  }

  return cursor
}

function compareIsoDate(left: string, right: string) {
  return Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)
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

  while (isWeekend(startDate)) {
    startDate = nextBusinessDate(startDate)
  }

  const checkpoint = await readCheckpoint({
    checkpointKey: options.checkpointKey,
  })

  if (checkpoint && compareIsoDate(checkpoint, startDate) >= 0 && compareIsoDate(checkpoint, endDate) < 0) {
    startDate = nextBusinessDate(checkpoint)
  }

  console.log(`Backfill range: ${startDate} -> ${endDate}`)
  console.log(`Checkpoint key: ${options.checkpointKey}`)

  let cursor = startDate
  let completed = 0

  while (compareIsoDate(cursor, endDate) <= 0) {
    if (isWeekend(cursor)) {
      cursor = nextBusinessDate(cursor)
      continue
    }

    const result = await syncDefenseMoneySignals({
      targetDate: cursor,
      triggerSource: 'script:backfill-defense-money-signals',
      includeMarket: false,
      includeLlm: false,
    })

    console.log(`${cursor}: ${result.status} · tx=${result.processedTransactions} briefs=${result.processedBriefs}`)

    await writeCheckpoint({
      checkpointKey: options.checkpointKey,
      cursorDate: cursor,
      payload: {
        status: result.status,
        warnings: result.warnings,
      },
    })

    if (result.status === 'failed') {
      console.log(`  ↳ skipping (will retry on next run): ${result.error ?? 'unknown error'}`)
      // Still advance cursor and checkpoint so we don't get stuck
    } else {
      completed += 1
    }

    cursor = nextBusinessDate(cursor)
  }

  console.log(`Backfill complete. Business days processed: ${completed}`)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
