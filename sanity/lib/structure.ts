import type {DefaultDocumentNodeResolver, StructureBuilder, StructureResolver} from 'sanity/structure'

import {JsonDocumentView, VerificationSummaryView} from './document-views'

const STORY_DIGEST_TYPE = 'storyDigest'
const NEWS_ITEM_TYPE = 'newsItem'
const SEMAPHOR_SOURCE_ID = 'semafor-security'
const MANAGED_SCHEMA_TYPES = new Set([STORY_DIGEST_TYPE, NEWS_ITEM_TYPE])

function storyDigestListItem(
  S: StructureBuilder,
  options: {
    id: string
    title: string
    filter: string
  },
) {
  return S.listItem()
    .id(options.id)
    .title(options.title)
    .child(
      S.documentList()
        .title(options.title)
        .schemaType(STORY_DIGEST_TYPE)
        .filter(`_type == "${STORY_DIGEST_TYPE}" && ${options.filter}`)
        .defaultOrdering([{field: 'generatedAt', direction: 'desc'}]),
    )
}

function newsItemListItem(
  S: StructureBuilder,
  options: {
    id: string
    title: string
    filter: string
    params?: Record<string, unknown>
  },
) {
  return S.listItem()
    .id(options.id)
    .title(options.title)
    .child(
      S.documentList()
        .title(options.title)
        .schemaType(NEWS_ITEM_TYPE)
        .filter(`_type == "${NEWS_ITEM_TYPE}" && ${options.filter}`)
        .params(options.params ?? {})
        .defaultOrdering([{field: 'publishedAt', direction: 'desc'}]),
    )
}

export const structure: StructureResolver = (S) =>
  S.list()
    .id('field-brief-root')
    .title('Field Brief CMS')
    .items([
      S.listItem()
        .id('digest-workflow')
        .title('Digest Workflow')
        .child(
          S.list()
            .id('digest-workflow-list')
            .title('Digest Workflow')
            .items([
              storyDigestListItem(S, {
                id: 'digests-needs-review',
                title: 'Needs Review',
                filter: 'coalesce(reviewStatus, "needs_review") == "needs_review"',
              }),
              storyDigestListItem(S, {
                id: 'digests-approved',
                title: 'Approved',
                filter: 'reviewStatus == "approved"',
              }),
              storyDigestListItem(S, {
                id: 'digests-published',
                title: 'Published',
                filter: 'reviewStatus == "published"',
              }),
              storyDigestListItem(S, {
                id: 'digests-transform-failures',
                title: 'Transform Failures',
                filter: 'transformStatus == "failed"',
              }),
              storyDigestListItem(S, {
                id: 'digests-congested',
                title: 'Congested Clusters',
                filter: 'isCongestedCluster == true',
              }),
              S.divider(),
              S.listItem()
                .id('all-story-digests')
                .title('All Story Digests')
                .child(
                  S.documentTypeList(STORY_DIGEST_TYPE)
                    .title('All Story Digests')
                    .defaultOrdering([{field: 'generatedAt', direction: 'desc'}]),
                ),
            ]),
        ),
      S.listItem()
        .id('evidence-library')
        .title('Evidence Library')
        .child(
          S.list()
            .id('evidence-library-list')
            .title('Evidence Library')
            .items([
              newsItemListItem(S, {
                id: 'news-fetched',
                title: 'Fetched Evidence',
                filter: 'contentFetchStatus == "fetched"',
              }),
              newsItemListItem(S, {
                id: 'news-missing-content',
                title: 'Missing or Failed Full Text',
                filter:
                  '(contentFetchStatus != "fetched" || !defined(contentFetchStatus) || !defined(fullText) || fullText == "")',
              }),
              newsItemListItem(S, {
                id: 'news-official-sources',
                title: 'Official Sources',
                filter: 'sourceCategory == "official"',
              }),
              newsItemListItem(S, {
                id: 'news-opinion-sources',
                title: 'Opinion Sources',
                filter: 'sourceCategory == "opinion"',
              }),
              newsItemListItem(S, {
                id: 'news-congested',
                title: 'Congested Cluster Evidence',
                filter: 'isCongestedCluster == true',
              }),
              newsItemListItem(S, {
                id: 'news-semafor-security',
                title: 'Semafor Security Stream',
                filter: 'sourceId == $sourceId',
                params: {sourceId: SEMAPHOR_SOURCE_ID},
              }),
              S.divider(),
              S.listItem()
                .id('all-news-items')
                .title('All News Items')
                .child(
                  S.documentTypeList(NEWS_ITEM_TYPE)
                    .title('All News Items')
                    .defaultOrdering([{field: 'publishedAt', direction: 'desc'}]),
                ),
            ]),
        ),
      S.listItem()
        .id('operations')
        .title('Operations')
        .child(
          S.list()
            .id('operations-list')
            .title('Operations')
            .items([
              S.listItem()
                .id('recent-editorial-drafts')
                .title('Recent Editorial Drafts')
                .child(
                  S.documentList()
                    .id('recent-editorial-drafts-list')
                    .title('Recent Editorial Drafts')
                    .filter('_type in ["storyDigest", "newsItem"] && _id in path("drafts.**")')
                    .defaultOrdering([{field: '_updatedAt', direction: 'desc'}]),
                ),
              S.listItem()
                .id('recently-updated-curated')
                .title('Recently Updated Curated Docs')
                .child(
                  S.documentList()
                    .id('recently-updated-curated-list')
                    .title('Recently Updated Curated Docs')
                    .filter('_type in ["storyDigest", "newsItem"]')
                    .defaultOrdering([{field: '_updatedAt', direction: 'desc'}]),
                ),
            ]),
        ),
      S.divider(),
      ...S.documentTypeListItems().filter((listItem) => {
        const id = listItem.getId()
        return !id || !MANAGED_SCHEMA_TYPES.has(id)
      }),
    ])

export const defaultDocumentNode: DefaultDocumentNodeResolver = (S, options) => {
  if (options.schemaType === STORY_DIGEST_TYPE || options.schemaType === NEWS_ITEM_TYPE) {
    return S.document().views([
      S.view.form().title('Editor'),
      S.view.component(VerificationSummaryView).title('Verification'),
      S.view.component(JsonDocumentView).title('JSON'),
    ])
  }

  return S.document().views([S.view.form()])
}
