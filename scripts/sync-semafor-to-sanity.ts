import {syncSemaphorSecurityNewsItemsToSanity} from '../lib/editorial/semaphor-sync'
import {createSanityTokenWriteClientFromEnv} from '../lib/sanity/client'

type CliOptions = {
  limit: number
  concurrency: number
  timeoutMs: number
  asJson: boolean
  showHelp: boolean
}

function parseInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    limit: 200,
    concurrency: 4,
    timeoutMs: 20000,
    asJson: false,
    showHelp: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      options.showHelp = true
      continue
    }

    if (arg === '--json') {
      options.asJson = true
      continue
    }

    if (arg.startsWith('--limit=')) {
      options.limit = parseInteger(arg.split('=')[1], options.limit)
      continue
    }

    if (arg === '--limit') {
      options.limit = parseInteger(argv[index + 1], options.limit)
      index += 1
      continue
    }

    if (arg.startsWith('--concurrency=')) {
      options.concurrency = parseInteger(arg.split('=')[1], options.concurrency)
      continue
    }

    if (arg === '--concurrency') {
      options.concurrency = parseInteger(argv[index + 1], options.concurrency)
      index += 1
      continue
    }

    if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = parseInteger(arg.split('=')[1], options.timeoutMs)
      continue
    }

    if (arg === '--timeout-ms') {
      options.timeoutMs = parseInteger(argv[index + 1], options.timeoutMs)
      index += 1
      continue
    }
  }

  return options
}

function printHelp() {
  console.log(`\nSync Semafor Security stories into Sanity newsItem docs with full text.\n\nUsage:\n  bun run scripts/sync-semafor-to-sanity.ts [flags]\n\nFlags:\n  --limit <n>          Max Semafor stories to sync (default: 200)\n  --concurrency <n>    Concurrent full-text fetches (default: 4)\n  --timeout-ms <n>     Per-article extraction timeout in milliseconds (default: 20000)\n  --json               Print JSON output\n  --help               Show this help\n`)
}

async function run() {
  const options = parseOptions(process.argv.slice(2))

  if (options.showHelp) {
    printHelp()
    return
  }

  const sanity = createSanityTokenWriteClientFromEnv()
  const result = await syncSemaphorSecurityNewsItemsToSanity({
    client: sanity,
    limit: options.limit,
    concurrency: options.concurrency,
    timeoutMs: options.timeoutMs,
  })

  if (options.asJson) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.log(`Fetched ${result.fetchedStories} Semafor stories.`)
  console.log(`Processed ${result.processed}. Synced full text for ${result.synced}. Failed ${result.failed}.`)

  if (result.errors.length > 0) {
    const preview = result.errors.slice(0, 20)
    console.log(`\nErrors (${preview.length}/${result.errors.length} shown):`)

    for (const error of preview) {
      console.log(`- ${error.storyId}: ${error.message}`)
      console.log(`  ${error.articleUrl}`)
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
