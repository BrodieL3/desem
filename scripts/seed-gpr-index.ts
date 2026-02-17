import {readFileSync} from 'node:fs'

import {createSupabaseAdminClientFromEnv} from '../lib/supabase/admin'

type GprRow = {
  period_date: string
  gpr: number
  gprt: number | null
  gpra: number | null
}

type CliOptions = {
  filePath: string
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {filePath: ''}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if ((arg === '--file' || arg === '-f') && argv[index + 1]) {
      options.filePath = argv[index + 1] ?? ''
      index += 1
      continue
    }

    if (arg === '--help') {
      console.log(`
Seed the macro_gpr table from a CSV file.

Usage:
  bun run scripts/seed-gpr-index.ts --file <path-to-csv>

Flags:
  --file, -f <path>   Path to the GPR CSV file (required)
  --help              Show this help

Supported CSV formats:
  1. Kaggle: columns month, year, GPR, GPRT, GPRA
  2. Official replication: columns DATES (M/D/YYYY), LGPR/GPR, LGPRT/GPRT, LGPRA/GPRA
  3. Simple: columns date, gpr, gprt, gpra
`)
      process.exit(0)
    }

    if (!arg?.startsWith('-') && !options.filePath) {
      options.filePath = arg ?? ''
    }
  }

  return options
}

function parseCsvLines(raw: string): string[][] {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)

  return lines.map((line) => line.split(',').map((cell) => cell.trim()))
}

function toNumber(value: string): number | null {
  if (!value || value === '—' || value === 'NA' || value === 'N/A' || value === '.') {
    return null
  }

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toIsoDate(month: number, year: number): string {
  const m = String(month).padStart(2, '0')
  return `${year}-${m}-01`
}

function parseMdyDate(value: string): string | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)

  if (!match) {
    return null
  }

  const month = String(match[1]).padStart(2, '0')
  return `${match[3]}-${month}-01`
}

function parseIsoLikeDate(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{1,2})/)

  if (!match) {
    return null
  }

  const month = String(match[2]).padStart(2, '0')
  return `${match[1]}-${month}-01`
}

type ColumnMapping = {
  type: 'kaggle' | 'official-log' | 'simple' | 'official-level'
  dateCol?: number
  monthCol?: number
  yearCol?: number
  gprCol: number
  gprtCol: number | null
  gpraCol: number | null
  isLog: boolean
}

function detectColumnMapping(headers: string[]): ColumnMapping | null {
  const lower = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''))

  // Kaggle format: month, year, GPR, GPRT, GPRA
  const monthIdx = lower.findIndex((h) => h === 'month')
  const yearIdx = lower.findIndex((h) => h === 'year')
  const gprIdx = lower.findIndex((h) => h === 'gpr')
  const gprtIdx = lower.findIndex((h) => h === 'gprt')
  const gpraIdx = lower.findIndex((h) => h === 'gpra')

  if (monthIdx >= 0 && yearIdx >= 0 && gprIdx >= 0) {
    return {
      type: 'kaggle',
      monthCol: monthIdx,
      yearCol: yearIdx,
      gprCol: gprIdx,
      gprtCol: gprtIdx >= 0 ? gprtIdx : null,
      gpraCol: gpraIdx >= 0 ? gpraIdx : null,
      isLog: false,
    }
  }

  // Official level format with L-prefix: DATES, LGPR, LGPRT, LGPRA
  // Despite the "L" prefix, these are level values (not logarithms) in the Granger CSV
  const datesIdx = lower.findIndex((h) => h === 'dates')
  const lgprIdx = lower.findIndex((h) => h === 'lgpr')
  const lgprtIdx = lower.findIndex((h) => h === 'lgprt')
  const lgpraIdx = lower.findIndex((h) => h === 'lgpra')

  if (datesIdx >= 0 && lgprIdx >= 0) {
    return {
      type: 'official-level',
      dateCol: datesIdx,
      gprCol: lgprIdx,
      gprtCol: lgprtIdx >= 0 ? lgprtIdx : null,
      gpraCol: lgpraIdx >= 0 ? lgpraIdx : null,
      isLog: false,
    }
  }

  // Official level format: DATES, GPR, GPRT, GPRA (non-log)
  if (datesIdx >= 0 && gprIdx >= 0) {
    return {
      type: 'official-level',
      dateCol: datesIdx,
      gprCol: gprIdx,
      gprtCol: gprtIdx >= 0 ? gprtIdx : null,
      gpraCol: gpraIdx >= 0 ? gpraIdx : null,
      isLog: false,
    }
  }

  // Simple format: date, gpr, gprt, gpra
  const dateIdx = lower.findIndex((h) => h === 'date' || h === 'period_date')

  if (dateIdx >= 0 && gprIdx >= 0) {
    return {
      type: 'simple',
      dateCol: dateIdx,
      gprCol: gprIdx,
      gprtCol: gprtIdx >= 0 ? gprtIdx : null,
      gpraCol: gpraIdx >= 0 ? gpraIdx : null,
      isLog: false,
    }
  }

  return null
}

function parseRows(lines: string[][], mapping: ColumnMapping): GprRow[] {
  const rows: GprRow[] = []

  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i]

    if (!cells || cells.length === 0) {
      continue
    }

    let periodDate: string | null = null

    if (mapping.type === 'kaggle' && mapping.monthCol !== undefined && mapping.yearCol !== undefined) {
      const month = toNumber(cells[mapping.monthCol] ?? '')
      const year = toNumber(cells[mapping.yearCol] ?? '')

      if (month && year && month >= 1 && month <= 12 && year >= 1900) {
        periodDate = toIsoDate(month, year)
      }
    } else if (mapping.dateCol !== undefined) {
      const raw = cells[mapping.dateCol] ?? ''
      periodDate = parseMdyDate(raw) || parseIsoLikeDate(raw)
    }

    if (!periodDate) {
      continue
    }

    let gpr = toNumber(cells[mapping.gprCol] ?? '')

    if (gpr === null) {
      continue
    }

    let gprt = mapping.gprtCol !== null ? toNumber(cells[mapping.gprtCol] ?? '') : null
    let gpra = mapping.gpraCol !== null ? toNumber(cells[mapping.gpraCol] ?? '') : null

    if (mapping.isLog) {
      gpr = Math.exp(gpr)
      gprt = gprt !== null ? Math.exp(gprt) : null
      gpra = gpra !== null ? Math.exp(gpra) : null
    }

    rows.push({
      period_date: periodDate,
      gpr: Math.round(gpr * 10000) / 10000,
      gprt: gprt !== null ? Math.round(gprt * 10000) / 10000 : null,
      gpra: gpra !== null ? Math.round(gpra * 10000) / 10000 : null,
    })
  }

  return rows
}

async function run() {
  const options = parseArgs(process.argv.slice(2))

  if (!options.filePath) {
    console.error('A CSV file path is required. Use --file <path> or pass the path directly.')
    console.error('Run with --help for usage info.')
    process.exit(1)
  }

  let raw: string

  try {
    raw = readFileSync(options.filePath, 'utf-8')
  } catch {
    console.error(`Could not read file: ${options.filePath}`)
    process.exit(1)
  }

  const lines = parseCsvLines(raw)
  const headers = lines[0]

  if (!headers || headers.length === 0) {
    console.error('CSV file appears empty or has no headers.')
    process.exit(1)
  }

  console.log(`Headers detected: ${headers.join(', ')}`)

  const mapping = detectColumnMapping(headers)

  if (!mapping) {
    console.error('Could not detect column mapping. Expected one of:')
    console.error('  - Kaggle:   month, year, GPR, GPRT, GPRA')
    console.error('  - Official: DATES, LGPR, LGPRT, LGPRA (or GPR, GPRT, GPRA)')
    console.error('  - Simple:   date, gpr, gprt, gpra')
    process.exit(1)
  }

  console.log(`Format detected: ${mapping.type}${mapping.isLog ? ' (log values — will exp())' : ''}`)

  const rows = parseRows(lines, mapping)

  if (rows.length === 0) {
    console.error('No valid rows parsed from CSV.')
    process.exit(1)
  }

  const dates = rows.map((r) => r.period_date).sort()
  console.log(`Parsed ${rows.length} rows: ${dates[0]} to ${dates[dates.length - 1]}`)

  const supabase = createSupabaseAdminClientFromEnv()
  let stored = 0

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const {error} = await supabase.from('macro_gpr').upsert(batch, {
      onConflict: 'period_date',
    })

    if (error) {
      console.error(`Upsert failed at batch ${i}: ${error.message}`)
      continue
    }

    stored += batch.length
  }

  console.log(`\nSeed complete. ${stored} rows stored in macro_gpr.`)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
