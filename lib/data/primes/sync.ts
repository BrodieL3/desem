import {createSupabaseAdminClientFromEnv} from '@/lib/supabase/admin'

import {upsertPrimeBackfillDocument} from './backfill'
import {parsePrimeMetricsFromText} from './parsers/metrics-from-text'
import {fetchSecFilingCandidates} from './providers/sec'
import {getPrimeRegistry} from './server'
import type {PrimeBackfillCompany, PrimeBackfillDocument, PrimeFilingType} from './types'

type SyncPrimeMetricsOptions = {
  filingsPerCompany?: number
}

export type SyncPrimeMetricsResult = {
  runId: string | null
  processedCompanies: number
  processedPeriods: number
  warnings: string[]
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function deriveFiscalPeriod(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const month = parsed.getUTCMonth() + 1
  const quarter = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4

  return {
    fiscalYear: parsed.getUTCFullYear(),
    fiscalQuarter: quarter,
    periodEnd: parsed.toISOString().slice(0, 10),
  }
}

function stripHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
}

function asFilingType(value: string | null): PrimeFilingType {
  if (value === '10-Q' || value === '10-K' || value === '8-K') {
    return value
  }

  return '8-K'
}

export async function syncPrimeMetricsFromSec(options: SyncPrimeMetricsOptions = {}): Promise<SyncPrimeMetricsResult> {
  const supabase = createSupabaseAdminClientFromEnv()
  const warnings: string[] = []
  const filingsPerCompany = Math.max(1, Math.min(options.filingsPerCompany ?? 1, 4))

  const {data: runRow, error: runCreateError} = await supabase
    .from('prime_ingestion_runs')
    .insert({
      trigger_source: 'script:sync-prime-metrics',
      status: 'running',
    })
    .select('id')
    .single<{id: string}>()

  if (runCreateError || !runRow) {
    throw new Error(`Unable to start prime ingestion run: ${runCreateError?.message ?? 'missing run id'}`)
  }

  const runId = runRow.id

  try {
    const registry = getPrimeRegistry()
    const backfillCompanies: PrimeBackfillCompany[] = []

    for (const company of registry) {
      const filings = await fetchSecFilingCandidates({
        cik: company.cik,
        forms: ['8-K', '10-Q', '10-K'],
        limit: filingsPerCompany,
      })

      const filing = filings[0]

      if (!filing) {
        warnings.push(`No SEC filings found for ${company.ticker}.`)
        continue
      }

      const period = deriveFiscalPeriod(compact(filing.reportDate) || filing.filedAt)

      if (!period) {
        warnings.push(`Unable to derive fiscal period for ${company.ticker} (${filing.accessionNo}).`)
        continue
      }

      if (!filing.filingUrl) {
        warnings.push(`Missing filing URL for ${company.ticker} (${filing.accessionNo}).`)
        continue
      }

      const response = await fetch(filing.filingUrl)

      if (!response.ok) {
        warnings.push(`Failed to fetch filing body for ${company.ticker} (${response.status}).`)
        continue
      }

      const body = await response.text()
      const parsedMetrics = parsePrimeMetricsFromText(stripHtml(body))

      backfillCompanies.push({
        ticker: company.ticker,
        name: company.name,
        cik: company.cik,
        colorToken: company.colorToken,
        periods: [
          {
            fiscalYear: period.fiscalYear,
            fiscalQuarter: period.fiscalQuarter,
            periodEnd: period.periodEnd,
            filingType: asFilingType(filing.filingType),
            filingDate: compact(filing.filedAt) || new Date().toISOString().slice(0, 10),
            sourceUrl: filing.filingUrl,
            accessionNo: filing.accessionNo,
            notes: 'Auto-synced from SEC submissions endpoint.',
            metrics: {
              backlog_total_b: {
                value: parsedMetrics.backlog_total_b?.value ?? null,
                status: parsedMetrics.backlog_total_b?.status ?? 'not_disclosed',
                unit: 'usd_billion',
                sourceUrl: filing.filingUrl,
                sourceNote: parsedMetrics.backlog_total_b?.sourceNote ?? undefined,
              },
              book_to_bill: {
                value: parsedMetrics.book_to_bill?.value ?? null,
                status: parsedMetrics.book_to_bill?.status ?? 'not_disclosed',
                unit: 'ratio',
                sourceUrl: filing.filingUrl,
                sourceNote: parsedMetrics.book_to_bill?.sourceNote ?? undefined,
              },
              revenue_b: {
                value: parsedMetrics.revenue_b?.value ?? null,
                status: parsedMetrics.revenue_b?.status ?? 'not_disclosed',
                unit: 'usd_billion',
                sourceUrl: filing.filingUrl,
                sourceNote: parsedMetrics.revenue_b?.sourceNote ?? undefined,
              },
              orders_b: {
                value: parsedMetrics.orders_b?.value ?? null,
                status: parsedMetrics.orders_b?.status ?? 'not_disclosed',
                unit: 'usd_billion',
                sourceUrl: filing.filingUrl,
                sourceNote: parsedMetrics.orders_b?.sourceNote ?? undefined,
              },
            },
          },
        ],
      })
    }

    if (backfillCompanies.length > 0) {
      const payload: PrimeBackfillDocument = {
        version: 'v1-sync',
        generatedAt: new Date().toISOString(),
        companies: backfillCompanies,
      }

      const result = await upsertPrimeBackfillDocument(supabase, payload)

      await supabase
        .from('prime_ingestion_runs')
        .update({
          status: 'succeeded',
          completed_at: new Date().toISOString(),
          processed_companies: result.companyCount,
          processed_periods: result.periodCount,
          error_summary: warnings.length > 0 ? warnings.join(' | ') : null,
        })
        .eq('id', runId)

      return {
        runId,
        processedCompanies: result.companyCount,
        processedPeriods: result.periodCount,
        warnings,
      }
    }

    await supabase
      .from('prime_ingestion_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_summary: warnings.length > 0 ? warnings.join(' | ') : 'No prime filing candidates were processed.',
      })
      .eq('id', runId)

    return {
      runId,
      processedCompanies: 0,
      processedPeriods: 0,
      warnings,
    }
  } catch (error) {
    await supabase
      .from('prime_ingestion_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_summary: error instanceof Error ? error.message : 'Unknown sync failure.',
      })
      .eq('id', runId)

    throw error
  }
}
