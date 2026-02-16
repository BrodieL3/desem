import {createSupabaseAdminClientFromEnv} from '../lib/supabase/admin'
import {getDefenseMoneySignalsConfig} from '../lib/data/signals/config'
import {fetchAllSamGovOpportunities} from '../lib/data/signals/providers/sam-gov'

type CliOptions = {
  lookbackDays: number
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {lookbackDays: 180}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--lookback-days' && argv[index + 1]) {
      const parsed = Number.parseInt(argv[index + 1] ?? '', 10)
      options.lookbackDays = Number.isFinite(parsed) ? Math.max(1, parsed) : 180
      index += 1
      continue
    }

    if (arg === '--help') {
      console.log(`
Backfill SAM.gov opportunities for DoD.

Usage:
  bun run scripts/backfill-sam-gov-opportunities.ts [flags]

Flags:
  --lookback-days <n>   Days of history to pull (default: 180)
  --help                Show this help
`)
      process.exit(0)
    }
  }

  return options
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const config = getDefenseMoneySignalsConfig()
  const apiKey = config.samGovApiKey

  if (!apiKey) {
    console.error('SAM_GOV_API_KEY (or SAM_KEY) is required. Set it in .env.local or environment.')
    process.exit(1)
  }

  const postedTo = new Date().toISOString().slice(0, 10)
  const postedFromDate = new Date()
  postedFromDate.setDate(postedFromDate.getDate() - options.lookbackDays)
  const postedFrom = postedFromDate.toISOString().slice(0, 10)

  // SAM.gov API uses MM/DD/YYYY format
  const formatSamDate = (iso: string) => {
    const [year, month, day] = iso.split('-')
    return `${month}/${day}/${year}`
  }

  const samFrom = formatSamDate(postedFrom)
  const samTo = formatSamDate(postedTo)

  console.log(`Backfill range: ${postedFrom} -> ${postedTo}`)
  console.log(`SAM.gov date format: ${samFrom} -> ${samTo}`)
  console.log(`Department filter: Department of Defense`)

  const {opportunities, warnings} = await fetchAllSamGovOpportunities({
    apiKey,
    postedFrom: samFrom,
    postedTo: samTo,
    departments: ['DEPT OF DEFENSE'],
    maxPages: 50,
  })

  console.log(`Fetched ${opportunities.length} opportunities.`)

  if (opportunities.length === 0) {
    if (warnings.length > 0) {
      console.log('Warnings:')

      for (const warning of warnings) {
        console.log(`- ${warning}`)
      }
    }

    process.exit(0)
  }

  const supabase = createSupabaseAdminClientFromEnv()

  const payload = opportunities.map((opp) => ({
    opportunity_id: opp.opportunityId,
    notice_type: opp.noticeType,
    title: opp.title,
    solicitation_number: opp.solicitationNumber,
    department: opp.department,
    sub_tier: opp.subTier,
    office: opp.office,
    posted_date: opp.postedDate,
    response_deadline: opp.responseDeadline,
    archive_date: opp.archiveDate,
    naics_code: opp.naicsCode,
    classification_code: opp.classificationCode,
    set_aside: opp.setAside,
    description: opp.description,
    estimated_value_low: opp.estimatedValueLow,
    estimated_value_high: opp.estimatedValueHigh,
    bucket_primary: opp.bucketPrimary,
    bucket_tags: opp.bucketTags,
    source_url: opp.sourceUrl,
    raw_payload: opp.rawPayload,
  }))

  let stored = 0

  for (let i = 0; i < payload.length; i += 200) {
    const batch = payload.slice(i, i + 200)
    const {error} = await supabase.from('sam_gov_opportunities').upsert(batch, {
      onConflict: 'opportunity_id',
    })

    if (error) {
      console.error(`Upsert failed at batch ${i}: ${error.message}`)
      continue
    }

    stored += batch.length
  }

  console.log(`\nBackfill complete.`)
  console.log(`Total opportunities stored: ${stored}`)

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
