export const newsItemSchema = {
  name: 'newsItem',
  type: 'document',
  title: 'News Item',
  fields: [
    {name: 'articleId', type: 'string'},
    {name: 'clusterKey', type: 'string'},
    {name: 'title', type: 'string'},
    {name: 'summary', type: 'text'},
    {name: 'fullTextExcerpt', type: 'text'},
    {name: 'articleUrl', type: 'url'},
    {name: 'sourceId', type: 'string'},
    {name: 'sourceName', type: 'string'},
    {name: 'sourceBadge', type: 'string'},
    {name: 'publishedAt', type: 'datetime'},
    {name: 'fetchedAt', type: 'datetime'},
    {name: 'wordCount', type: 'number'},
    {name: 'readingMinutes', type: 'number'},
    {name: 'contentFetchStatus', type: 'string'},
    {name: 'isCongestedCluster', type: 'boolean'},
    {
      name: 'topics',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {name: 'topicId', type: 'string'},
            {name: 'slug', type: 'string'},
            {name: 'label', type: 'string'},
            {name: 'isPrimary', type: 'boolean'},
          ],
        },
      ],
    },
    {name: 'syncedAt', type: 'datetime'},
  ],
}
