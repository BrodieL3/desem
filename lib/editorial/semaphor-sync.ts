import type {SanityClient} from '@sanity/client'

import {extractArticleContentFromUrl} from '@/lib/ingest/extract-article-content'
import {sanitizeHeadlineText, sanitizePlainText} from '@/lib/utils'

import {fetchSemaphorSecurityStories} from './semaphor-security'

const SEMAPHOR_SOURCE_ID = 'semafor-security'
const SEMAPHOR_SOURCE_NAME = 'Semafor Security'

type SemaphorSyncError = {
  storyId: string
  articleUrl: string
  message: string
}

export type SemaphorSyncResult = {
  fetchedStories: number
  processed: number
  synced: number
  failed: number
  errors: SemaphorSyncError[]
}

type SyncSemaphorSecurityNewsItemsOptions = {
  client: SanityClient
  limit?: number
  concurrency?: number
  timeoutMs?: number
  userAgent?: string
  now?: Date
}

function sanitizeSanityId(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 110)
}

function semaphorNewsItemId(storyId: string) {
  return `newsItem-${sanitizeSanityId(storyId)}`
}

function compact(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  return sanitizePlainText(value).replace(/\s+/g, ' ').trim()
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  const boundedLimit = Math.max(1, limit)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      await task(items[index])
    }
  }

  const workers = Array.from({length: Math.min(items.length, boundedLimit)}, () => worker())
  await Promise.all(workers)
}

export async function syncSemaphorSecurityNewsItemsToSanity(
  options: SyncSemaphorSecurityNewsItemsOptions
): Promise<SemaphorSyncResult> {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 200), 200))
  const concurrency = Math.max(1, Math.min(Math.trunc(options.concurrency ?? 4), 10))
  const timeoutMs = Math.max(5000, Math.min(Math.trunc(options.timeoutMs ?? 20000), 30000))
  const nowIso = (options.now ?? new Date()).toISOString()

  const stories = await fetchSemaphorSecurityStories(limit)
  const result: SemaphorSyncResult = {
    fetchedStories: stories.length,
    processed: stories.length,
    synced: 0,
    failed: 0,
    errors: [],
  }

  await runWithConcurrency(stories, concurrency, async (story) => {
    try {
      const extraction = await extractArticleContentFromUrl(story.articleUrl, {
        timeoutMs,
        userAgent: options.userAgent ?? 'FieldBriefSemaforSanitySync/1.0 (+https://localhost)',
      })

      const title = sanitizeHeadlineText(story.headline)
      const summary = compact(story.subtitle) || null

      await options.client.createOrReplace({
        _id: semaphorNewsItemId(story.id),
        _type: 'newsItem',
        articleId: story.id,
        clusterKey: story.id,
        title,
        summary,
        fullText: extraction.fullText,
        fullTextExcerpt: extraction.fullTextExcerpt,
        articleUrl: story.articleUrl,
        sourceId: SEMAPHOR_SOURCE_ID,
        sourceName: SEMAPHOR_SOURCE_NAME,
        sourceCategory: 'journalism',
        sourceBadge: 'Reporting',
        publishedAt: story.publishedAt,
        fetchedAt: nowIso,
        wordCount: extraction.wordCount,
        readingMinutes: extraction.readingMinutes,
        contentFetchStatus: extraction.contentFetchStatus,
        isCongestedCluster: false,
        topics: [
          {
            _key: 'semafor-security',
            topicId: 'semafor-security',
            slug: 'security',
            label: 'Security',
            topicType: 'organization',
            isPrimary: true,
          },
        ],
        leadImageUrl: extraction.leadImageUrl ?? story.imageUrl,
        canonicalImageUrl: extraction.canonicalImageUrl ?? story.imageUrl,
        syncedAt: nowIso,
      })

      if (extraction.contentFetchStatus === 'fetched' && extraction.fullText) {
        result.synced += 1
      } else {
        result.failed += 1
        result.errors.push({
          storyId: story.id,
          articleUrl: story.articleUrl,
          message: extraction.contentFetchError ?? 'Semafor article extraction returned no content.',
        })
      }
    } catch (error) {
      result.failed += 1
      result.errors.push({
        storyId: story.id,
        articleUrl: story.articleUrl,
        message: error instanceof Error ? error.message : 'Unknown Semafor sync failure.',
      })
    }
  })

  return result
}
