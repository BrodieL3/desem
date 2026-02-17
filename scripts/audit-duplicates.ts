/**
 * Audit Supabase tables for duplicate rows.
 *
 * Usage:
 *   bun scripts/audit-duplicates.ts
 */

import {createSupabaseAdminClientFromEnv} from '../lib/supabase/admin'

const supabase = createSupabaseAdminClientFromEnv()

type DupResult = {key: string; count: number}

async function countRows(table: string) {
  const {count, error} = await supabase.from(table).select('*', {count: 'exact', head: true})
  if (error) return `error: ${error.message}`
  return count
}

async function checkAwardTransactionDups() {
  console.log('\n--- defense_money_award_transactions ---')
  const total = await countRows('defense_money_award_transactions')
  console.log(`  Total rows: ${total}`)

  // Logical dups: same award_id + action_date + recipient + amount
  const {data: rows, error} = await supabase.rpc('exec_sql', {
    sql: `
      SELECT award_id, action_date::text, recipient_name, transaction_amount::text, count(*) as cnt
      FROM defense_money_award_transactions
      GROUP BY award_id, action_date, recipient_name, transaction_amount
      HAVING count(*) > 1
      ORDER BY count(*) DESC
      LIMIT 20
    `,
  })

  if (error) {
    // RPC might not exist — fall back to client-side detection
    console.log(`  Cannot run SQL RPC (${error.message}), falling back to client-side check...`)
    await checkAwardDupsClientSide()
    return
  }

  if (!rows || rows.length === 0) {
    console.log('  No logical duplicates found (award_id + action_date + recipient + amount)')
  } else {
    console.log(`  Found ${rows.length}+ duplicate groups:`)
    for (const row of rows.slice(0, 10)) {
      console.log(`    award_id=${row.award_id} date=${row.action_date} recipient=${row.recipient_name} amount=${row.transaction_amount} count=${row.cnt}`)
    }
  }
}

async function checkAwardDupsClientSide() {
  // Fetch recent rows and check for logical dups client-side
  const {data: rows, error} = await supabase
    .from('defense_money_award_transactions')
    .select('id, generated_internal_id, award_id, action_date, recipient_name, transaction_amount')
    .order('action_date', {ascending: false})
    .limit(5000)

  if (error || !rows) {
    console.log(`  Error fetching rows: ${error?.message}`)
    return
  }

  console.log(`  Fetched ${rows.length} recent rows for client-side analysis`)

  // Group by natural key: award_id + action_date + recipient + amount
  const groups = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = `${row.award_id}|${row.action_date}|${row.recipient_name}|${row.transaction_amount}`
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  const dups = [...groups.entries()].filter(([, group]) => group.length > 1).sort((a, b) => b[1].length - a[1].length)

  if (dups.length === 0) {
    console.log('  No logical duplicates found in recent 5000 rows')
  } else {
    console.log(`  Found ${dups.length} duplicate groups in recent 5000 rows:`)
    for (const [key, group] of dups.slice(0, 15)) {
      const [awardId, date, recipient, amount] = key.split('|')
      console.log(`    award_id=${awardId} date=${date} recipient=${recipient} amount=${amount} count=${group.length}`)
      for (const row of group) {
        console.log(`      id=${row.id} generated_internal_id=${row.generated_internal_id}`)
      }
    }
  }
}

async function checkMarketQuoteDups() {
  console.log('\n--- defense_money_market_quotes ---')
  const total = await countRows('defense_money_market_quotes')
  console.log(`  Total rows: ${total}`)

  // Unique constraint is (trade_date, ticker) so true dups shouldn't exist
  // But check for same ticker+date with different prices
  const {data: rows, error} = await supabase
    .from('defense_money_market_quotes')
    .select('id, trade_date, ticker, price')
    .order('trade_date', {ascending: false})
    .limit(3000)

  if (error || !rows) {
    console.log(`  Error: ${error?.message}`)
    return
  }

  console.log(`  Fetched ${rows.length} recent rows`)

  const groups = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = `${row.ticker}|${row.trade_date}`
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  const dups = [...groups.entries()].filter(([, group]) => group.length > 1)
  console.log(`  Duplicate (ticker, trade_date) pairs: ${dups.length}`)
  for (const [key, group] of dups.slice(0, 5)) {
    console.log(`    ${key} -> ${group.length} rows`)
  }
}

async function checkRollupDups() {
  console.log('\n--- defense_money_rollups ---')
  const total = await countRows('defense_money_rollups')
  console.log(`  Total rows: ${total}`)

  const {data: rows, error} = await supabase
    .from('defense_money_rollups')
    .select('id, period_type, period_start, period_end')
    .order('period_start', {ascending: false})
    .limit(500)

  if (error || !rows) {
    console.log(`  Error: ${error?.message}`)
    return
  }

  const groups = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = `${row.period_type}|${row.period_start}|${row.period_end}`
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  const dups = [...groups.entries()].filter(([, group]) => group.length > 1)
  console.log(`  Duplicate (period_type, period_start, period_end) groups: ${dups.length}`)
  for (const [key, group] of dups.slice(0, 5)) {
    console.log(`    ${key} -> ${group.length} rows`)
  }
}

async function checkArticleDups() {
  console.log('\n--- ingested_articles ---')
  const total = await countRows('ingested_articles')
  console.log(`  Total rows: ${total}`)

  // Check for duplicate titles (fuzzy logical dups)
  const {data: rows, error} = await supabase
    .from('ingested_articles')
    .select('id, title, article_url, canonical_url, source_id, published_at')
    .order('created_at', {ascending: false})
    .limit(5000)

  if (error || !rows) {
    console.log(`  Error: ${error?.message}`)
    return
  }

  console.log(`  Fetched ${rows.length} recent rows`)

  // Check for identical titles
  const titleGroups = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = row.title?.toLowerCase().trim() ?? ''
    if (!key) continue
    const group = titleGroups.get(key) ?? []
    group.push(row)
    titleGroups.set(key, group)
  }

  const titleDups = [...titleGroups.entries()].filter(([, group]) => group.length > 1).sort((a, b) => b[1].length - a[1].length)
  console.log(`  Duplicate titles: ${titleDups.length}`)
  for (const [title, group] of titleDups.slice(0, 10)) {
    console.log(`    "${title.slice(0, 80)}..." -> ${group.length} rows`)
    for (const row of group) {
      console.log(`      id=${row.id} source=${row.source_id} url=${row.article_url?.slice(0, 60)}`)
    }
  }
}

async function checkDefenseGovDups() {
  console.log('\n--- defense_dot_gov_daily_contracts ---')
  const total = await countRows('defense_dot_gov_daily_contracts')
  console.log(`  Total rows: ${total}`)

  const {data: rows, error} = await supabase
    .from('defense_dot_gov_daily_contracts')
    .select('id, announcement_date, contract_number, contractor_name, award_amount')
    .order('announcement_date', {ascending: false})
    .limit(2000)

  if (error || !rows) {
    console.log(`  Error: ${error?.message}`)
    return
  }

  const groups = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = `${row.announcement_date}|${row.contract_number}|${row.contractor_name}`
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  const dups = [...groups.entries()].filter(([, group]) => group.length > 1)
  console.log(`  Duplicate (date, contract_number, contractor) groups: ${dups.length}`)
  for (const [key, group] of dups.slice(0, 5)) {
    console.log(`    ${key} -> ${group.length} rows`)
  }
}

async function checkSamGovDups() {
  console.log('\n--- sam_gov_opportunities ---')
  const total = await countRows('sam_gov_opportunities')
  console.log(`  Total rows: ${total}`)
}

async function main() {
  console.log('=== Supabase Duplicate Audit ===')
  console.log(`Time: ${new Date().toISOString()}`)

  await checkAwardTransactionDups()
  await checkMarketQuoteDups()
  await checkRollupDups()
  await checkArticleDups()
  await checkDefenseGovDups()
  await checkSamGovDups()

  console.log('\n=== Done ===')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
