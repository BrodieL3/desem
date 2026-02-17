/**
 * Remove duplicate award transactions that were ingested from both
 * the USAspending API (CONT_AWD_ prefix) and CSV imports (9700_ prefix).
 *
 * Strategy:
 *   1. Scan in date-descending batches
 *   2. Group rows by natural key: (award_id, action_date, recipient_name, transaction_amount)
 *   3. For each group with >1 row, keep the preferred row and delete the rest
 *   4. Prefer CONT_AWD_ rows (API source) over 9700_ rows (CSV source)
 *
 * Usage:
 *   bun scripts/dedup-award-transactions.ts              # dry run (default)
 *   bun scripts/dedup-award-transactions.ts --apply       # actually delete
 */

import {createSupabaseAdminClientFromEnv} from '../lib/supabase/admin'

const BATCH_SIZE = 1000

type Row = {
  id: string
  generated_internal_id: string
  award_id: string
  action_date: string
  recipient_name: string
  transaction_amount: number | string
}

function naturalKey(row: Row) {
  return `${row.award_id}|${row.action_date}|${row.recipient_name}|${row.transaction_amount}`
}

function preferredRow(a: Row, b: Row): Row {
  // Prefer CONT_AWD_ (API) over 9700_ (CSV)
  const aIsApi = a.generated_internal_id.startsWith('CONT_AWD_')
  const bIsApi = b.generated_internal_id.startsWith('CONT_AWD_')
  if (aIsApi && !bIsApi) return a
  if (bIsApi && !aIsApi) return b
  // Both same source — keep the first one (arbitrary but stable)
  return a
}

async function main() {
  const apply = process.argv.includes('--apply')
  console.log(`Mode: ${apply ? 'APPLY (will delete duplicates)' : 'DRY RUN (no changes)'}`)

  const supabase = createSupabaseAdminClientFromEnv()

  // Get total count
  const {count: totalCount} = await supabase
    .from('defense_money_award_transactions')
    .select('*', {count: 'exact', head: true})
  console.log(`Total rows in table: ${totalCount?.toLocaleString()}`)

  let offset = 0
  let totalScanned = 0
  let totalDupGroups = 0
  let totalToDelete = 0
  let totalDeleted = 0
  const idsToDelete: string[] = []

  // Scan the entire table in batches
  while (true) {
    const {data: rows, error} = await supabase
      .from('defense_money_award_transactions')
      .select('id, generated_internal_id, award_id, action_date, recipient_name, transaction_amount')
      .order('action_date', {ascending: false})
      .order('id', {ascending: true})
      .range(offset, offset + BATCH_SIZE - 1)
      .returns<Row[]>()

    if (error) {
      console.error(`Fetch error at offset ${offset}: ${error.message}`)
      break
    }

    if (!rows || rows.length === 0) break
    totalScanned += rows.length

    // Group by natural key within this batch
    const groups = new Map<string, Row[]>()
    for (const row of rows) {
      const key = naturalKey(row)
      const group = groups.get(key) ?? []
      group.push(row)
      groups.set(key, group)
    }

    // Find duplicates
    for (const [, group] of groups) {
      if (group.length <= 1) continue

      totalDupGroups += 1

      // Find the row to keep
      let keeper = group[0]
      for (let i = 1; i < group.length; i++) {
        keeper = preferredRow(keeper, group[i])
      }

      // Mark the rest for deletion
      for (const row of group) {
        if (row.id !== keeper.id) {
          idsToDelete.push(row.id)
          totalToDelete += 1
        }
      }
    }

    if (totalScanned % 10_000 === 0) {
      console.log(`  scanned ${totalScanned.toLocaleString()} rows, found ${totalDupGroups.toLocaleString()} dup groups, ${totalToDelete.toLocaleString()} rows to delete`)
    }

    // Flush deletes in batches of 200
    if (apply && idsToDelete.length >= 200) {
      const batch = idsToDelete.splice(0, 200)
      const {error: delError} = await supabase
        .from('defense_money_award_transactions')
        .delete()
        .in('id', batch)

      if (delError) {
        console.error(`  Delete error: ${delError.message}`)
      } else {
        totalDeleted += batch.length
      }
    }

    offset += BATCH_SIZE
  }

  // Flush remaining deletes
  if (apply && idsToDelete.length > 0) {
    const batch = idsToDelete.splice(0, idsToDelete.length)
    const {error: delError} = await supabase
      .from('defense_money_award_transactions')
      .delete()
      .in('id', batch)

    if (delError) {
      console.error(`  Delete error: ${delError.message}`)
    } else {
      totalDeleted += batch.length
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Scanned: ${totalScanned.toLocaleString()} rows`)
  console.log(`Duplicate groups: ${totalDupGroups.toLocaleString()}`)
  console.log(`Rows to delete: ${totalToDelete.toLocaleString()}`)
  if (apply) {
    console.log(`Rows deleted: ${totalDeleted.toLocaleString()}`)
  } else {
    console.log(`(dry run — re-run with --apply to delete)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
