import type {SupabaseClient} from '@supabase/supabase-js'

type ArticleTopicRow = {
  article_id: string
  topics: {
    label: string
    topic_type: string | null
  } | null
}

type ContractRow = {
  source: 'usaspending' | 'defense_gov'
  id: string
  recipientName: string
}

type LinkRow = {
  article_id: string
  contract_source: string
  contract_id: string
  match_type: string
  match_confidence: number
}

const COMPANY_NAME_VARIANTS: Record<string, string[]> = {
  'Lockheed Martin': ['LOCKHEED MARTIN CORPORATION', 'LOCKHEED MARTIN CORP', 'LOCKHEED MARTIN'],
  RTX: ['RTX CORPORATION', 'RTX CORP', 'RAYTHEON', 'RAYTHEON TECHNOLOGIES', 'RAYTHEON COMPANY'],
  'Northrop Grumman': ['NORTHROP GRUMMAN CORPORATION', 'NORTHROP GRUMMAN CORP', 'NORTHROP GRUMMAN'],
  'Boeing Defense': ['THE BOEING COMPANY', 'BOEING COMPANY', 'BOEING'],
  'General Dynamics': [
    'GENERAL DYNAMICS CORPORATION',
    'GENERAL DYNAMICS CORP',
    'GENERAL DYNAMICS',
    'GENERAL DYNAMICS INFORMATION TECHNOLOGY',
    'GDIT',
  ],
  L3Harris: ['L3HARRIS TECHNOLOGIES INC', 'L3HARRIS TECHNOLOGIES', 'L3 HARRIS', 'L3HARRIS'],
  'Anduril Industries': ['ANDURIL INDUSTRIES INC', 'ANDURIL INDUSTRIES', 'ANDURIL'],
  'Palantir Technologies': ['PALANTIR TECHNOLOGIES INC', 'PALANTIR TECHNOLOGIES', 'PALANTIR USG INC', 'PALANTIR'],
  Leidos: ['LEIDOS INC', 'LEIDOS HOLDINGS', 'LEIDOS'],
  'Huntington Ingalls Industries': ['HUNTINGTON INGALLS INDUSTRIES INC', 'HUNTINGTON INGALLS', 'HII'],
  AeroVironment: ['AEROVIRONMENT INC', 'AEROVIRONMENT'],
  'Kratos Defense & Security Solutions': ['KRATOS DEFENSE & SECURITY SOLUTIONS INC', 'KRATOS DEFENSE', 'KRATOS'],
  'CACI International': ['CACI INTERNATIONAL INC', 'CACI INTERNATIONAL', 'CACI'],
}

function buildCompanyLookup() {
  const lookup = new Map<string, string>()

  for (const [topicLabel, variants] of Object.entries(COMPANY_NAME_VARIANTS)) {
    lookup.set(topicLabel.toUpperCase(), topicLabel)

    for (const variant of variants) {
      lookup.set(variant.toUpperCase(), topicLabel)
    }
  }

  return lookup
}

function fuzzyMatchCompany(contractorName: string, companyLookup: Map<string, string>) {
  const upper = contractorName.toUpperCase().trim()

  const exact = companyLookup.get(upper)

  if (exact) {
    return {topicLabel: exact, confidence: 0.95}
  }

  for (const [variant, topicLabel] of companyLookup) {
    if (upper.includes(variant) || variant.includes(upper)) {
      return {topicLabel, confidence: 0.75}
    }
  }

  return null
}

export async function linkArticlesToContracts(input: {
  supabase: SupabaseClient
  articleDaysBack?: number
  contractDaysBack?: number
}): Promise<{linkedCount: number; warnings: string[]}> {
  const warnings: string[] = []
  const articleDaysBack = input.articleDaysBack ?? 7
  const contractDaysBack = input.contractDaysBack ?? 30

  const articleCutoff = new Date()
  articleCutoff.setDate(articleCutoff.getDate() - articleDaysBack)
  const articleCutoffIso = articleCutoff.toISOString()

  const contractCutoff = new Date()
  contractCutoff.setDate(contractCutoff.getDate() - contractDaysBack)
  const contractCutoffIso = contractCutoff.toISOString().slice(0, 10)

  const {data: topicRows, error: topicError} = await input.supabase
    .from('article_topics')
    .select('article_id, topics(label, topic_type)')
    .in('topics.topic_type', ['company', 'program', 'technology'])
    .gte('created_at', articleCutoffIso)
    .returns<ArticleTopicRow[]>()

  if (topicError) {
    warnings.push(`Failed to fetch article topics: ${topicError.message}`)
    return {linkedCount: 0, warnings}
  }

  const articleCompanyMap = new Map<string, Set<string>>()
  const articleProgramMap = new Map<string, Set<string>>()

  for (const row of topicRows ?? []) {
    if (!row.topics) {
      continue
    }

    const label = row.topics.label.trim()
    const topicType = row.topics.topic_type

    if (topicType === 'company') {
      const set = articleCompanyMap.get(row.article_id) ?? new Set()
      set.add(label)
      articleCompanyMap.set(row.article_id, set)
    } else if (topicType === 'program' || topicType === 'technology') {
      const set = articleProgramMap.get(row.article_id) ?? new Set()
      set.add(label.toUpperCase())
      articleProgramMap.set(row.article_id, set)
    }
  }

  if (articleCompanyMap.size === 0 && articleProgramMap.size === 0) {
    return {linkedCount: 0, warnings}
  }

  const contracts: ContractRow[] = []

  const {data: usaspendingRows} = await input.supabase
    .from('defense_money_award_transactions')
    .select('generated_internal_id, recipient_name')
    .gte('action_date', contractCutoffIso)
    .returns<Array<{generated_internal_id: string; recipient_name: string}>>()

  for (const row of usaspendingRows ?? []) {
    contracts.push({
      source: 'usaspending',
      id: row.generated_internal_id,
      recipientName: row.recipient_name,
    })
  }

  const {data: defenseGovRows} = await input.supabase
    .from('defense_dot_gov_daily_contracts')
    .select('id, contractor_name')
    .gte('announcement_date', contractCutoffIso)
    .returns<Array<{id: string; contractor_name: string}>>()

  for (const row of defenseGovRows ?? []) {
    contracts.push({
      source: 'defense_gov',
      id: row.id,
      recipientName: row.contractor_name,
    })
  }

  if (contracts.length === 0) {
    return {linkedCount: 0, warnings}
  }

  const companyLookup = buildCompanyLookup()
  const contractByTopicLabel = new Map<string, Array<{source: string; id: string; confidence: number}>>()

  for (const contract of contracts) {
    const match = fuzzyMatchCompany(contract.recipientName, companyLookup)

    if (!match) {
      continue
    }

    const entries = contractByTopicLabel.get(match.topicLabel) ?? []
    entries.push({source: contract.source, id: contract.id, confidence: match.confidence})
    contractByTopicLabel.set(match.topicLabel, entries)
  }

  const links: LinkRow[] = []

  for (const [articleId, companyLabels] of articleCompanyMap) {
    for (const label of companyLabels) {
      const matchedContracts = contractByTopicLabel.get(label)

      if (!matchedContracts) {
        continue
      }

      for (const contract of matchedContracts) {
        links.push({
          article_id: articleId,
          contract_source: contract.source,
          contract_id: contract.id,
          match_type: 'company_name',
          match_confidence: contract.confidence,
        })
      }
    }
  }

  if (links.length === 0) {
    return {linkedCount: 0, warnings}
  }

  const seen = new Set<string>()
  const dedupedLinks = links.filter((link) => {
    const key = `${link.article_id}:${link.contract_source}:${link.contract_id}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })

  let linkedCount = 0

  for (let i = 0; i < dedupedLinks.length; i += 200) {
    const batch = dedupedLinks.slice(i, i + 200)
    const {error} = await input.supabase.from('article_contract_links').upsert(batch, {
      onConflict: 'article_id,contract_source,contract_id',
    })

    if (error) {
      warnings.push(`Cross-reference upsert failed at batch ${i}: ${error.message}`)
      continue
    }

    linkedCount += batch.length
  }

  return {linkedCount, warnings}
}
