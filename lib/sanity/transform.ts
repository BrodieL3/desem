import type {SanityClient} from '@sanity/client'

import type {StoryCluster, StoryDigestRecord} from '@/lib/editorial/types'

type TransformApi = {
  agent?: {
    action?: {
      transform?: (payload: unknown) => Promise<unknown>
    }
  }
}

function resolveTransform(client: SanityClient) {
  const transform = (client as unknown as TransformApi).agent?.action?.transform

  if (!transform) {
    throw new Error('Sanity client does not expose agent.action.transform.')
  }

  return transform
}

function compact(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n')
}

export async function transformStoryDigestInPlace(input: {
  client: SanityClient
  schemaId: string
  documentId: string
  digest: StoryDigestRecord
  cluster: StoryCluster
}) {
  const transform = resolveTransform(input.client)

  const citationContext = input.digest.citations
    .map((citation, index) => `${index + 1}. ${citation.sourceName} | ${citation.headline} | ${citation.url}`)
    .join('\n')

  const memberContext = input.cluster.members
    .slice(0, 20)
    .map((member) => `${member.article.sourceName}: ${member.article.title}`)
    .join('\n')

  await transform({
    schemaId: input.schemaId,
    documentId: input.documentId,
    instruction: compact([
      'Refine this defense story digest for clarity and signal-to-noise.',
      'Do not invent facts or entities. Keep all claims grounded in citations.',
      'Keep headline concise (<130 chars), dek concise (<240 chars), keyPoints to 3-5 bullets.',
      'Preserve explicit source attribution in citations and keep reviewStatus as needs_review.',
      'Preserve reporting-first balance; keep opinion citations clearly labeled and limited.',
      'If this story appears press-release-driven, keep at least one official citation.',
      'Use neutral editorial tone and avoid speculative language.',
    ]),
    instructionParams: {
      currentHeadline: input.digest.headline,
      currentDek: input.digest.dek,
      currentWhy: input.digest.whyItMatters,
      clusterTopic: input.cluster.topicLabel ?? 'general defense coverage',
      memberHeadlines: memberContext,
      citations: citationContext,
    },
    target: [
      {path: ['headline']},
      {path: ['dek']},
      {path: ['keyPoints']},
      {path: ['whyItMatters']},
      {path: ['riskLevel']},
    ],
  })
}
