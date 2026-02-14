import {
  enrichArticleContentBatch,
  enrichArticleTopicsBatch,
  getArticlesMissingTopics,
  getArticlesNeedingContent,
} from '../lib/ingest/enrich-articles'
import {createSupabaseAdminClientFromEnv} from '../lib/ingest/persist'

async function run() {
  const supabase = createSupabaseAdminClientFromEnv()

  const needingContent = await getArticlesNeedingContent(supabase)

  console.log(`Found ${needingContent.length} articles needing content enrichment.`)

  const contentResult = await enrichArticleContentBatch(supabase, needingContent, {
    concurrency: 5,
    timeoutMs: 15000,
  })

  console.log(
    `Content enrichment complete. Processed=${contentResult.processed}, fetched=${contentResult.fetched}, failed=${contentResult.failed}.`
  )

  const missingTopics = await getArticlesMissingTopics(supabase)

  console.log(`Found ${missingTopics.length} articles missing topic links.`)

  const topicResult = await enrichArticleTopicsBatch(supabase, missingTopics, {
    concurrency: 2,
  })

  console.log(`Topic enrichment complete. Processed=${topicResult.processed}, withTopics=${topicResult.withTopics}.`)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
