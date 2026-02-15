import {
  enrichArticleContentBatch,
  enrichArticleTopicsBatch,
  getFetchedArticlesPage,
  getArticlesMissingTopics,
  getArticlesNeedingContent,
} from '../lib/ingest/enrich-articles'
import {createSupabaseAdminClientFromEnv} from '../lib/ingest/persist'

type TopicsRefreshMode = 'missing' | 'full'

type CliOptions = {
  batchSize: number
  contentConcurrency: number
  topicsConcurrency: number
  timeoutMs: number
  topicsRefresh: TopicsRefreshMode
  showHelp: boolean
}

function parseInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseTopicsRefresh(value: string | undefined): TopicsRefreshMode {
  if (value === 'full') {
    return 'full'
  }

  return 'missing'
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    batchSize: 800,
    contentConcurrency: 5,
    topicsConcurrency: 2,
    timeoutMs: 15000,
    topicsRefresh: 'missing',
    showHelp: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index]

    if (rawArg === '--help' || rawArg === '-h') {
      options.showHelp = true
      continue
    }

    if (rawArg.startsWith('--batch-size=')) {
      options.batchSize = parseInteger(rawArg.split('=')[1], options.batchSize)
      continue
    }

    if (rawArg === '--batch-size') {
      options.batchSize = parseInteger(argv[index + 1], options.batchSize)
      index += 1
      continue
    }

    if (rawArg.startsWith('--content-concurrency=')) {
      options.contentConcurrency = parseInteger(rawArg.split('=')[1], options.contentConcurrency)
      continue
    }

    if (rawArg === '--content-concurrency') {
      options.contentConcurrency = parseInteger(argv[index + 1], options.contentConcurrency)
      index += 1
      continue
    }

    if (rawArg.startsWith('--topics-concurrency=')) {
      options.topicsConcurrency = parseInteger(rawArg.split('=')[1], options.topicsConcurrency)
      continue
    }

    if (rawArg === '--topics-concurrency') {
      options.topicsConcurrency = parseInteger(argv[index + 1], options.topicsConcurrency)
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

    if (rawArg.startsWith('--topics-refresh=')) {
      options.topicsRefresh = parseTopicsRefresh(rawArg.split('=')[1])
      continue
    }

    if (rawArg === '--topics-refresh') {
      options.topicsRefresh = parseTopicsRefresh(argv[index + 1])
      index += 1
      continue
    }
  }

  return options
}

function printHelp() {
  console.log(`\nBackfill article content and topic metadata.\n\nUsage:\n  bun run scripts/backfill-article-content.ts [flags]\n\nFlags:\n  --batch-size <n>            Batch size for content/topic processing (default: 800)\n  --content-concurrency <n>   Concurrent content fetches (default: 5)\n  --topics-concurrency <n>    Concurrent topic refresh workers (default: 2)\n  --timeout-ms <n>            Content fetch timeout in ms (default: 15000)\n  --topics-refresh <mode>     Topic refresh mode: missing | full (default: missing)\n  --help                      Show this help\n`)
}

async function pruneOrphanTopics(supabase: ReturnType<typeof createSupabaseAdminClientFromEnv>, batchSize: number) {
  let offset = 0
  const orphanIdsToDelete: string[] = []

  while (true) {
    const {data: topicRows, error: topicError} = await supabase
      .from('topics')
      .select('id')
      .order('created_at', {ascending: true})
      .range(offset, offset + batchSize - 1)
      .returns<Array<{id: string}>>()

    if (topicError || !topicRows) {
      throw new Error(`Unable to scan topics for orphan cleanup: ${topicError?.message ?? 'No topic rows returned.'}`)
    }

    if (topicRows.length === 0) {
      break
    }

    const ids = topicRows.map((row) => row.id)

    const [{data: articleTopicRows, error: articleTopicError}, {data: followedRows, error: followedError}] = await Promise.all([
      supabase.from('article_topics').select('topic_id').in('topic_id', ids).returns<Array<{topic_id: string}>>(),
      supabase.from('user_topic_follows').select('topic_id').in('topic_id', ids).returns<Array<{topic_id: string}>>(),
    ])

    if (articleTopicError) {
      throw new Error(`Unable to resolve topic usage from article_topics: ${articleTopicError.message}`)
    }

    if (followedError) {
      throw new Error(`Unable to resolve topic usage from user_topic_follows: ${followedError.message}`)
    }

    const referencedIds = new Set<string>()

    for (const row of articleTopicRows ?? []) {
      referencedIds.add(row.topic_id)
    }

    for (const row of followedRows ?? []) {
      referencedIds.add(row.topic_id)
    }

    const orphanIds = ids.filter((id) => !referencedIds.has(id))

    if (orphanIds.length > 0) {
      orphanIdsToDelete.push(...orphanIds)
    }

    offset += topicRows.length
  }

  let deleted = 0

  for (let index = 0; index < orphanIdsToDelete.length; index += batchSize) {
    const chunk = orphanIdsToDelete.slice(index, index + batchSize)

    const {error: deleteError} = await supabase.from('topics').delete().in('id', chunk)

    if (deleteError) {
      throw new Error(`Unable to delete orphan topics: ${deleteError.message}`)
    }

    deleted += chunk.length
  }

  return deleted
}

async function run() {
  const options = parseCliOptions(process.argv.slice(2))

  if (options.showHelp) {
    printHelp()
    return
  }

  const boundedBatchSize = Math.max(50, Math.min(options.batchSize, 2000))
  const boundedContentConcurrency = Math.max(1, Math.min(options.contentConcurrency, 12))
  const boundedTopicsConcurrency = Math.max(1, Math.min(options.topicsConcurrency, 8))
  const boundedTimeoutMs = Math.max(5000, Math.min(options.timeoutMs, 45000))

  const supabase = createSupabaseAdminClientFromEnv()

  const totalContent = {
    processed: 0,
    fetched: 0,
    failed: 0,
  }

  while (true) {
    const needingContent = await getArticlesNeedingContent(supabase, boundedBatchSize)

    if (needingContent.length === 0) {
      break
    }

    console.log(`Content batch: ${needingContent.length} articles.`)

    const contentResult = await enrichArticleContentBatch(supabase, needingContent, {
      concurrency: boundedContentConcurrency,
      timeoutMs: boundedTimeoutMs,
    })

    totalContent.processed += contentResult.processed
    totalContent.fetched += contentResult.fetched
    totalContent.failed += contentResult.failed

    if (needingContent.length < boundedBatchSize) {
      break
    }
  }

  console.log(
    `Content enrichment complete. Processed=${totalContent.processed}, fetched=${totalContent.fetched}, failed=${totalContent.failed}.`
  )

  const totalTopics = {
    processed: 0,
    withTopics: 0,
    failed: 0,
  }

  if (options.topicsRefresh === 'full') {
    let offset = 0

    while (true) {
      const topicBatch = await getFetchedArticlesPage(supabase, {
        offset,
        limit: boundedBatchSize,
      })

      if (topicBatch.length === 0) {
        break
      }

      console.log(`Topic refresh batch (full): ${topicBatch.length} articles (offset=${offset}).`)

      const topicResult = await enrichArticleTopicsBatch(supabase, topicBatch, {
        concurrency: boundedTopicsConcurrency,
      })

      totalTopics.processed += topicResult.processed
      totalTopics.withTopics += topicResult.withTopics
      totalTopics.failed += topicResult.failed
      offset += topicBatch.length

      if (topicBatch.length < boundedBatchSize) {
        break
      }
    }
  } else {
    while (true) {
      const missingTopics = await getArticlesMissingTopics(supabase, boundedBatchSize)

      if (missingTopics.length === 0) {
        break
      }

      console.log(`Topic refresh batch (missing): ${missingTopics.length} articles.`)

      const topicResult = await enrichArticleTopicsBatch(supabase, missingTopics, {
        concurrency: boundedTopicsConcurrency,
      })

      totalTopics.processed += topicResult.processed
      totalTopics.withTopics += topicResult.withTopics
      totalTopics.failed += topicResult.failed

      if (missingTopics.length < boundedBatchSize) {
        break
      }
    }
  }

  console.log(
    `Topic enrichment complete. Processed=${totalTopics.processed}, withTopics=${totalTopics.withTopics}, failed=${totalTopics.failed}, mode=${options.topicsRefresh}.`
  )

  const prunedTopics = await pruneOrphanTopics(supabase, Math.min(500, boundedBatchSize))
  console.log(`Pruned orphan topics: ${prunedTopics}.`)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
