import type {SupabaseClient} from '@supabase/supabase-js'

import type {PrimeBackfillDocument, PrimeMetricKey, PrimeTicker} from './types'
import {primeMetricKeyValues} from './types'

type PrimeCompanyDbRow = {
  id: string
  ticker: string
}

export type PrimeBackfillPersistResult = {
  companyCount: number
  periodCount: number
  metricPointCount: number
}

const primeDisplayOrder: Record<PrimeTicker, number> = {
  LMT: 1,
  RTX: 2,
  BA: 3,
  GD: 4,
  NOC: 5,
  LHX: 6,
}

function asPeriodMetricRows(input: {
  periodId: string
  metrics: NonNullable<PrimeBackfillDocument['companies'][number]['periods'][number]['metrics']>
}) {
  const rows: Array<{
    period_id: string
    metric_key: PrimeMetricKey
    value_num: number | null
    unit: string
    disclosure_status: 'disclosed' | 'not_disclosed'
    source_url: string | null
    source_note: string | null
  }> = []

  for (const metricKey of primeMetricKeyValues) {
    const metric = input.metrics[metricKey]

    if (!metric) {
      continue
    }

    rows.push({
      period_id: input.periodId,
      metric_key: metricKey,
      value_num: metric.value,
      unit: metric.unit ?? (metricKey === 'book_to_bill' ? 'ratio' : 'usd_billion'),
      disclosure_status: metric.status,
      source_url: metric.sourceUrl ?? null,
      source_note: metric.sourceNote ?? null,
    })
  }

  return rows
}

async function resolveCompanyIdByTicker(supabase: SupabaseClient, ticker: PrimeTicker) {
  const {data, error} = await supabase.from('prime_companies').select('id, ticker').eq('ticker', ticker).maybeSingle<PrimeCompanyDbRow>()

  if (error) {
    throw new Error(`Unable to resolve prime company by ticker ${ticker}: ${error.message}`)
  }

  return data?.id ?? null
}

export async function upsertPrimeBackfillDocument(
  supabase: SupabaseClient,
  document: PrimeBackfillDocument
): Promise<PrimeBackfillPersistResult> {
  let companyCount = 0
  let periodCount = 0
  let metricPointCount = 0

  for (const company of document.companies) {
    const {error: companyError} = await supabase.from('prime_companies').upsert(
      {
        ticker: company.ticker,
        name: company.name,
        cik: company.cik,
        is_active: true,
        display_order: primeDisplayOrder[company.ticker],
      },
      {onConflict: 'ticker'}
    )

    if (companyError) {
      throw new Error(`Unable to upsert prime company ${company.ticker}: ${companyError.message}`)
    }

    const companyId = await resolveCompanyIdByTicker(supabase, company.ticker)

    if (!companyId) {
      throw new Error(`Prime company id missing after upsert for ticker ${company.ticker}.`)
    }

    companyCount += 1

    for (const period of company.periods) {
      const {data: periodRecord, error: periodError} = await supabase
        .from('prime_reporting_periods')
        .upsert(
          {
            company_id: companyId,
            fiscal_year: period.fiscalYear,
            fiscal_quarter: period.fiscalQuarter,
            period_end: period.periodEnd,
            filing_type: period.filingType,
            filing_date: period.filingDate,
            source_url: period.sourceUrl,
            accession_no: period.accessionNo ?? null,
            notes: period.notes ?? null,
          },
          {onConflict: 'company_id,fiscal_year,fiscal_quarter'}
        )
        .select('id')
        .single<{id: string}>()

      if (periodError || !periodRecord) {
        throw new Error(
          `Unable to upsert reporting period ${company.ticker} ${period.fiscalYear}Q${period.fiscalQuarter}: ${periodError?.message ?? 'Missing period id.'}`
        )
      }

      periodCount += 1

      const metricRows = asPeriodMetricRows({
        periodId: periodRecord.id,
        metrics: period.metrics,
      })

      if (metricRows.length === 0) {
        continue
      }

      const {error: metricError} = await supabase.from('prime_metric_points').upsert(metricRows, {
        onConflict: 'period_id,metric_key',
      })

      if (metricError) {
        throw new Error(
          `Unable to upsert metric points ${company.ticker} ${period.fiscalYear}Q${period.fiscalQuarter}: ${metricError.message}`
        )
      }

      metricPointCount += metricRows.length
    }
  }

  return {
    companyCount,
    periodCount,
    metricPointCount,
  }
}
