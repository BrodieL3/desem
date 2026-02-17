/**
 * Import USAspending contract CSV files into the defense_money_award_transactions table.
 *
 * Usage:
 *   bun scripts/import-usaspending-csv.ts 2025_contracts.csv
 *   bun scripts/import-usaspending-csv.ts 2025_contracts.csv 2026_contracts.csv
 *   bun scripts/import-usaspending-csv.ts --min-amount 500000 2025_contracts.csv
 *   bun scripts/import-usaspending-csv.ts --dry-run 2025_contracts.csv
 */

import {createReadStream} from 'node:fs'
import {stat} from 'node:fs/promises'
import {resolve} from 'node:path'
import {parse} from 'csv-parse'

import {createSupabaseAdminClientFromEnv} from '../lib/supabase/admin'
import {classifyDefenseMoneyBucket} from '../lib/data/signals/taxonomy'

const DEFAULT_MIN_AMOUNT = 1_000_000
const BATCH_SIZE = 500

type CsvRow = Record<string, string>

type ParsedTransaction = {
  generated_internal_id: string
  action_date: string
  award_id: string
  modification_number: string | null
  recipient_name: string
  awarding_agency_name: string
  transaction_amount: number
  outlayed_amount: number | null
  obligated_amount: number | null
  potential_amount: number | null
  performance_start_date: string | null
  performance_current_end_date: string | null
  performance_potential_end_date: string | null
  naics_code: string | null
  psc_code: string | null
  transaction_description: string | null
  bucket_primary: string
  bucket_tags: string[]
  source_url: string
  raw_payload: Record<string, unknown>
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function toNumber(value: string | null | undefined) {
  if (!value) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toDate(value: string | null | undefined) {
  if (!value) return null
  // CSV dates may have trailing " 00:00:00" — take only YYYY-MM-DD
  const trimmed = value.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function parseRow(row: CsvRow, minAmount: number): ParsedTransaction | null {
  // Only import Department of Defense contracts
  const topAgency = compact(row.awarding_agency_name)
  if (topAgency !== 'Department of Defense') return null

  const generatedInternalId = compact(row.contract_transaction_unique_key)
  const actionDate = compact(row.action_date)
  const awardId = compact(row.award_id_piid)
  const modificationNumber = compact(row.modification_number) || null
  const recipientName = compact(row.recipient_name)
  const awardingAgencyName = compact(row.awarding_sub_agency_name)
  const amount = toNumber(row.current_total_value_of_award)
  const outlayedAmount = toNumber(row.total_outlayed_amount_for_overall_award)
  const obligatedAmount = toNumber(row.total_dollars_obligated)
  const potentialAmount = toNumber(row.potential_total_value_of_award)
  const performanceStartDate = toDate(row.period_of_performance_start_date)
  const performanceCurrentEndDate = toDate(row.period_of_performance_current_end_date)
  const performancePotentialEndDate = toDate(row.period_of_performance_potential_end_date)
  const naicsCode = compact(row.naics_code) || null
  const pscCode = compact(row.product_or_service_code) || null
  const transactionDescription = compact(row.transaction_description) || null
  const sourceUrl = compact(row.usaspending_permalink)

  if (!generatedInternalId || !actionDate || !awardId || !recipientName || !awardingAgencyName) {
    return null
  }

  if (amount === null || amount < minAmount) {
    return null
  }

  const classification = classifyDefenseMoneyBucket({
    pscCode,
    naicsCode,
    transactionDescription,
  })

  return {
    generated_internal_id: generatedInternalId,
    action_date: actionDate,
    award_id: awardId,
    modification_number: modificationNumber,
    recipient_name: recipientName,
    awarding_agency_name: awardingAgencyName,
    transaction_amount: amount,
    outlayed_amount: outlayedAmount,
    obligated_amount: obligatedAmount,
    potential_amount: potentialAmount,
    performance_start_date: performanceStartDate,
    performance_current_end_date: performanceCurrentEndDate,
    performance_potential_end_date: performancePotentialEndDate,
    naics_code: naicsCode,
    psc_code: pscCode,
    transaction_description: transactionDescription,
    bucket_primary: classification.primary,
    bucket_tags: classification.tags,
    source_url: sourceUrl || `https://www.usaspending.gov/search`,
    raw_payload: {},
  }
}

async function processFile(filePath: string, options: {minAmount: number; dryRun: boolean}) {
  const absolutePath = resolve(filePath)
  const fileInfo = await stat(absolutePath)
  const fileSizeMb = (fileInfo.size / 1024 / 1024).toFixed(0)

  console.log(`\nProcessing: ${absolutePath} (${fileSizeMb} MB)`)

  const supabase = options.dryRun ? null : createSupabaseAdminClientFromEnv()

  let totalRead = 0
  let totalQualified = 0
  let totalUpserted = 0
  let totalSkipped = 0
  let batch: ParsedTransaction[] = []

  async function flushBatch() {
    if (batch.length === 0) return

    if (options.dryRun) {
      totalUpserted += batch.length
      batch = []
      return
    }

    const {error} = await supabase!.from('defense_money_award_transactions').upsert(batch, {
      onConflict: 'generated_internal_id',
    })

    if (error) {
      console.error(`  Upsert error: ${error.message}`)
      totalSkipped += batch.length
    } else {
      totalUpserted += batch.length
    }

    batch = []
  }

  const parser = createReadStream(absolutePath).pipe(
    parse({columns: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true})
  )

  for await (const row of parser as AsyncIterable<CsvRow>) {
    totalRead += 1

    const parsed = parseRow(row, options.minAmount)
    if (!parsed) continue

    totalQualified += 1
    batch.push(parsed)

    if (batch.length >= BATCH_SIZE) {
      await flushBatch()

      if (totalQualified % 5000 === 0) {
        console.log(`  ... ${totalRead.toLocaleString()} read, ${totalQualified.toLocaleString()} qualified, ${totalUpserted.toLocaleString()} upserted`)
      }
    }
  }

  await flushBatch()

  console.log(`  Done: ${totalRead.toLocaleString()} read, ${totalQualified.toLocaleString()} qualified, ${totalUpserted.toLocaleString()} upserted, ${totalSkipped.toLocaleString()} errors`)

  return {totalRead, totalQualified, totalUpserted, totalSkipped}
}

async function main() {
  const args = process.argv.slice(2)
  let minAmount = DEFAULT_MIN_AMOUNT
  let dryRun = false
  const files: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--min-amount' && args[i + 1]) {
      minAmount = Number.parseFloat(args[i + 1])
      i += 1
    } else if (arg === '--dry-run') {
      dryRun = true
    } else {
      files.push(arg)
    }
  }

  if (files.length === 0) {
    console.error('Usage: bun scripts/import-usaspending-csv.ts [--min-amount N] [--dry-run] <file.csv> [file2.csv ...]')
    process.exit(1)
  }

  console.log(`Min amount: ${minAmount.toLocaleString()}`)
  console.log(`Dry run: ${dryRun}`)
  console.log(`Files: ${files.join(', ')}`)

  let grandTotal = {read: 0, qualified: 0, upserted: 0, skipped: 0}

  for (const file of files) {
    const result = await processFile(file, {minAmount, dryRun})
    grandTotal.read += result.totalRead
    grandTotal.qualified += result.totalQualified
    grandTotal.upserted += result.totalUpserted
    grandTotal.skipped += result.totalSkipped
  }

  console.log(`\nGrand total: ${grandTotal.read.toLocaleString()} read, ${grandTotal.qualified.toLocaleString()} qualified, ${grandTotal.upserted.toLocaleString()} upserted, ${grandTotal.skipped.toLocaleString()} errors`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
