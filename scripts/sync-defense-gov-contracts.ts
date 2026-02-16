import {createSupabaseAdminClientFromEnv} from '../lib/supabase/admin'
import {getDefenseMoneySignalsConfig} from '../lib/data/signals/config'
import {fetchDefenseGovDailyContracts} from '../lib/data/signals/providers/defense-gov'

async function run() {
  const config = getDefenseMoneySignalsConfig()

  if (!config.defenseGovEnabled) {
    console.log('Defense.gov sync is disabled (DEFENSE_GOV_ENABLED=false).')
    process.exit(0)
  }

  console.log(`Fetching Defense.gov contracts (lookback: ${config.defenseGovLookbackDays} days)...`)

  const {contracts, warnings} = await fetchDefenseGovDailyContracts({
    rssUrl: config.defenseGovRssUrl,
    lookbackDays: config.defenseGovLookbackDays,
  })

  console.log(`Fetched ${contracts.length} contracts from RSS feed.`)

  if (contracts.length === 0) {
    if (warnings.length > 0) {
      console.log('Warnings:')

      for (const warning of warnings) {
        console.log(`- ${warning}`)
      }
    }

    process.exit(0)
  }

  const supabase = createSupabaseAdminClientFromEnv()

  const payload = contracts.map((contract) => ({
    announcement_date: contract.announcementDate,
    contract_number: contract.contractNumber,
    contractor_name: contract.contractorName,
    awarding_agency: contract.awardingAgency,
    award_amount: contract.awardAmount,
    location: contract.location,
    description: contract.description,
    bucket_primary: contract.bucketPrimary,
    bucket_tags: contract.bucketTags,
    source_url: contract.sourceUrl,
    raw_html: contract.rawHtml,
  }))

  let stored = 0

  for (let i = 0; i < payload.length; i += 100) {
    const batch = payload.slice(i, i + 100)
    const {error} = await supabase.from('defense_dot_gov_daily_contracts').upsert(batch, {
      onConflict: 'announcement_date,contract_number,contractor_name',
    })

    if (error) {
      console.error(`Upsert failed at batch ${i}: ${error.message}`)
      continue
    }

    stored += batch.length
  }

  console.log(`\nSync complete.`)
  console.log(`Total contracts stored: ${stored}`)

  if (warnings.length > 0) {
    console.log('Warnings:')

    for (const warning of warnings) {
      console.log(`- ${warning}`)
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
