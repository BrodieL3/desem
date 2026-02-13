export const storyDigestSchema = {
  name: 'storyDigest',
  type: 'document',
  title: 'Story Digest',
  fields: [
    {name: 'clusterKey', type: 'string'},
    {name: 'representativeArticleId', type: 'string'},
    {name: 'topicLabel', type: 'string'},
    {name: 'headline', type: 'string'},
    {name: 'dek', type: 'text'},
    {name: 'keyPoints', type: 'array', of: [{type: 'string'}]},
    {name: 'whyItMatters', type: 'text'},
    {name: 'riskLevel', type: 'string'},
    {
      name: 'citations',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {name: 'articleId', type: 'string'},
            {name: 'headline', type: 'string'},
            {name: 'sourceName', type: 'string'},
            {name: 'url', type: 'url'},
          ],
        },
      ],
    },
    {name: 'citationCount', type: 'number'},
    {name: 'generationMode', type: 'string'},
    {name: 'transformStatus', type: 'string'},
    {name: 'reviewStatus', type: 'string'},
    {name: 'isCongestedCluster', type: 'boolean'},
    {name: 'articleCount24h', type: 'number'},
    {name: 'uniqueSources24h', type: 'number'},
    {name: 'congestionScore', type: 'number'},
    {name: 'generatedAt', type: 'datetime'},
  ],
}
