import {writeFile} from 'node:fs/promises'

import {pullDefenseArticles} from '../lib/ingest/pull-defense-articles'
import {createSupabaseAdminClientFromEnv, upsertPullResultToSupabase} from '../lib/ingest/persist'

interface CliOptions {
  limit: number
  maxPerSource: number
  sinceHours: number
  timeoutMs: number
  sourceIds?: string[]
  jsonPath?: string
  toSupabase: boolean
  showHelp: boolean
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    limit: 200,
    maxPerSource: 30,
    sinceHours: 168,
    timeoutMs: 15000,
    toSupabase: false,
    showHelp: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index]

    if (rawArg === '--help' || rawArg === '-h') {
      options.showHelp = true
      continue
    }

    if (rawArg === '--to-supabase') {
      options.toSupabase = true
      continue
    }

    if (rawArg.startsWith('--limit=')) {
      options.limit = parseInteger(rawArg.split('=')[1], options.limit)
      continue
    }

    if (rawArg === '--limit') {
      options.limit = parseInteger(argv[index + 1], options.limit)
      index += 1
      continue
    }

    if (rawArg.startsWith('--max-per-source=')) {
      options.maxPerSource = parseInteger(rawArg.split('=')[1], options.maxPerSource)
      continue
    }

    if (rawArg === '--max-per-source') {
      options.maxPerSource = parseInteger(argv[index + 1], options.maxPerSource)
      index += 1
      continue
    }

    if (rawArg.startsWith('--since-hours=')) {
      options.sinceHours = parseInteger(rawArg.split('=')[1], options.sinceHours)
      continue
    }

    if (rawArg === '--since-hours') {
      options.sinceHours = parseInteger(argv[index + 1], options.sinceHours)
      index += 1
      continue
    }

    if (rawArg.startsWith('--timeout-ms=')) {
      options.timeoutMs = parseInteger(rawArg.split('=')[1], options.timeoutMs)
      continue
    }

    if (rawArg === '--timeout-ms') {
      options.timeoutMs = parseInteger(argv[index + 1], options.timeoutMs)
      index += 1
      continue
    }

    if (rawArg.startsWith('--sources=')) {
      options.sourceIds = parseCommaList(rawArg.split('=')[1] || '')
      continue
    }

    if (rawArg === '--sources') {
      options.sourceIds = parseCommaList(argv[index + 1] || '')
      index += 1
      continue
    }

    if (rawArg.startsWith('--json=')) {
      options.jsonPath = rawArg.split('=')[1] || undefined
      continue
    }

    if (rawArg === '--json') {
      options.jsonPath = argv[index + 1]
      index += 1
    }
  }

  return options
}

function printHelp() {
  console.log(`\nPull and normalize defense articles from RSS/Atom feeds.\n\nUsage:\n  bun run scripts/pull-defense-articles.ts [flags]\n\nFlags:\n  --limit <n>             Max articles in final output (default: 200)\n  --max-per-source <n>    Max articles per source feed before dedupe (default: 30)\n  --since-hours <n>       Keep only items newer than N hours (default: 168)\n  --timeout-ms <n>        HTTP timeout per source in ms (default: 15000)\n  --sources a,b,c         Restrict pull to source ids\n  --json <path>           Write full pull result to JSON file\n  --to-supabase           Upsert into Supabase tables (requires service role key)\n  --help                  Show this help\n`)
}

function formatDate(value?: string): string {
  if (!value) {
    return 'unknown date'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toISOString()
}

async function upsertToSupabase(result: Awaited<ReturnType<typeof pullDefenseArticles>>) {
  const supabase = createSupabaseAdminClientFromEnv()
  return upsertPullResultToSupabase(supabase, result)
}

async function run() {
  const options = parseCliOptions(process.argv.slice(2))

  if (options.showHelp) {
    printHelp()
    return
  }

  const result = await pullDefenseArticles({
    limit: options.limit,
    maxPerSource: options.maxPerSource,
    sinceHours: options.sinceHours,
    timeoutMs: options.timeoutMs,
    sourceIds: options.sourceIds,
  })

  const pulledSources = new Set(result.articles.map((article) => article.sourceId))

  console.log(`Pulled ${result.articleCount} articles from ${pulledSources.size}/${result.sourceCount} configured sources.`)
  console.log(`Fetched at ${result.fetchedAt}.`)

  if (result.errors.length > 0) {
    console.log(`\nSource errors (${result.errors.length}):`)
    for (const error of result.errors) {
      console.log(`- ${error.sourceId} (${error.sourceName}): ${error.message}`)
    }
  }

  const previewCount = Math.min(result.articles.length, 20)
  if (previewCount > 0) {
    console.log(`\nTop ${previewCount} articles:`)
    for (const article of result.articles.slice(0, previewCount)) {
      console.log(`- [${article.sourceName}] ${formatDate(article.publishedAt)} :: ${article.title}`)
      console.log(`  ${article.url}`)
    }
  }

  if (options.jsonPath) {
    await writeFile(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
    console.log(`\nSaved pull result to ${options.jsonPath}`)
  }

  if (options.toSupabase) {
    const persisted = await upsertToSupabase(result)
    console.log(`\nUpserted ${persisted.upsertedArticleCount} articles into Supabase.`)
    console.log('Run `bun run scripts/backfill-article-content.ts` to enrich full text and topic metadata.')
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
