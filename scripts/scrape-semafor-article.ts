import {extractArticleContentFromUrl} from '../lib/ingest/extract-article-content'

type CliOptions = {
  articleUrl: string
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

function isSemaforArticleUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.hostname.endsWith('semafor.com') && /^\/article\//.test(parsed.pathname)
  } catch {
    return false
  }
}

function parseOptions(argv: string[]): CliOptions {
  let articleUrl = ''
  let timeoutMs = 15000
  let asJson = false
  let showHelp = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      showHelp = true
      continue
    }

    if (arg === '--json') {
      asJson = true
      continue
    }

    if (arg.startsWith('--timeout-ms=')) {
      timeoutMs = parseInteger(arg.split('=')[1], timeoutMs)
      continue
    }

    if (arg === '--timeout-ms') {
      timeoutMs = parseInteger(argv[index + 1], timeoutMs)
      index += 1
      continue
    }

    if (arg.startsWith('--url=')) {
      articleUrl = arg.split('=')[1] ?? articleUrl
      continue
    }

    if (arg === '--url') {
      articleUrl = argv[index + 1] ?? articleUrl
      index += 1
      continue
    }

    if (!arg.startsWith('-') && !articleUrl) {
      articleUrl = arg
    }
  }

  return {
    articleUrl,
    timeoutMs,
    asJson,
    showHelp,
  }
}

function printHelp() {
  console.log(`\nScrape full text from a Semafor article URL.\n\nUsage:\n  bun run scripts/scrape-semafor-article.ts --url <semafor-article-url> [flags]\n  bun run scripts/scrape-semafor-article.ts <semafor-article-url> [flags]\n\nFlags:\n  --json                 Print structured JSON output instead of plain text\n  --timeout-ms <n>       HTTP timeout in milliseconds (default: 15000)\n  --help                 Show this help\n`)
}

async function run() {
  const options = parseOptions(process.argv.slice(2))

  if (options.showHelp) {
    printHelp()
    return
  }

  if (!options.articleUrl) {
    throw new Error('A Semafor article URL is required. Use --url <url>.')
  }

  if (!isSemaforArticleUrl(options.articleUrl)) {
    throw new Error('URL must be a Semafor article path (https://www.semafor.com/article/...).')
  }

  const extraction = await extractArticleContentFromUrl(options.articleUrl, {
    timeoutMs: options.timeoutMs,
    userAgent: 'FieldBriefSemaforScraper/1.0 (+https://localhost)',
  })

  if (options.asJson) {
    console.log(
      JSON.stringify(
        {
          articleUrl: options.articleUrl,
          contentFetchStatus: extraction.contentFetchStatus,
          contentFetchError: extraction.contentFetchError,
          wordCount: extraction.wordCount,
          readingMinutes: extraction.readingMinutes,
          fullText: extraction.fullText,
          fullTextExcerpt: extraction.fullTextExcerpt,
          leadImageUrl: extraction.leadImageUrl,
          canonicalImageUrl: extraction.canonicalImageUrl,
          contentFetchedAt: extraction.contentFetchedAt,
        },
        null,
        2
      )
    )
    return
  }

  if (extraction.contentFetchStatus !== 'fetched' || !extraction.fullText) {
    throw new Error(extraction.contentFetchError ?? 'Failed to extract article body.')
  }

  console.log(extraction.fullText)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
