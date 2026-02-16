const DEFAULT_ALLOWED_AGENCIES = ['Department of Defense']
const DEFAULT_MARKET_TICKERS = ['LMT', 'RTX', 'NOC', 'GD', 'BA', 'LHX']

function asBoolean(value: string | undefined, fallback: boolean) {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

function asPositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

function asPositiveFloat(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseFloat(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

function asList(value: string | undefined, fallback: string[]) {
  if (!value) {
    return fallback
  }

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return entries.length > 0 ? entries : fallback
}

export function isDefenseMoneySignalsEnabled() {
  return asBoolean(process.env.DATA_MONEY_SIGNALS_ENABLED, true)
}

export function getDefenseMoneySignalsConfig() {
  return {
    enabled: isDefenseMoneySignalsEnabled(),
    usaspendingApiBaseUrl: process.env.USASPENDING_API_BASE_URL?.trim() || 'https://api.usaspending.gov',
    minTransactionUsd: asPositiveFloat(process.env.DATA_MONEY_MIN_TRANSACTION_USD, 10_000_000, 0, 10_000_000_000),
    maxTransactionPages: asPositiveInt(process.env.DATA_MONEY_MAX_TRANSACTION_PAGES, 25, 1, 300),
    allowedAwardingAgencies: asList(process.env.DATA_MONEY_ALLOWED_AWARDING_AGENCIES, DEFAULT_ALLOWED_AGENCIES),
    bucketRulesetVersion: process.env.DATA_MONEY_BUCKET_RULESET_VERSION?.trim() || 'v1',
    marketTickers: asList(process.env.DATA_MONEY_MARKET_TICKERS, DEFAULT_MARKET_TICKERS).map((entry) => entry.toUpperCase()),
    marketBackfillDays: asPositiveInt(process.env.DATA_MONEY_MARKET_BACKFILL_DAYS, 31, 1, 365),
    finnhubApiKey: process.env.NEXT_PUBLIC_FINNHUB_API_KEY?.trim() || process.env.FINNHUB_API_KEY?.trim() || '',
    llmEnabled: asBoolean(process.env.DATA_MONEY_LLM_ENABLED, true),
    llmModel: process.env.DATA_MONEY_LLM_MODEL?.trim() || 'gpt-4.1-mini',
    macroSnapshotPath:
      process.env.DATA_MONEY_MACRO_SNAPSHOT_PATH?.trim() ||
      `${process.cwd()}/scripts/data/macro-budget-context.yaml`,

    // Defense.gov RSS
    defenseGovEnabled: asBoolean(process.env.DEFENSE_GOV_ENABLED, true),
    defenseGovRssUrl:
      process.env.DEFENSE_GOV_RSS_URL?.trim() ||
      'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=9&Site=945',
    defenseGovLookbackDays: asPositiveInt(process.env.DEFENSE_GOV_LOOKBACK_DAYS, 7, 1, 30),

    // Tiingo
    tiingoApiKey: process.env.TIINGO_API_KEY?.trim() || '',
    tiingoEnabled: asBoolean(process.env.TIINGO_ENABLED, true),
    tiingoBackfillYears: asPositiveInt(process.env.TIINGO_BACKFILL_YEARS, 3, 1, 10),

    // SAM.gov
    samGovApiKey: process.env.SAM_GOV_API_KEY?.trim() || process.env.SAM_KEY?.trim() || '',
    samGovEnabled: asBoolean(process.env.SAM_GOV_ENABLED, true),
    samGovLookbackDays: asPositiveInt(process.env.SAM_GOV_LOOKBACK_DAYS, 90, 1, 365),
  }
}
