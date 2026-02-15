import type {DefenseMoneyActionLens, DefenseMoneyCitation, DefenseMoneyGeneratedMode} from './types'

type LlmClaim = {
  text: string
  citationIds: string[]
}

type LlmPayload = {
  actionLens: DefenseMoneyActionLens
  summary: string
  soWhat: string
  claims: LlmClaim[]
}

export type GuardrailedImplicationResult = {
  generatedMode: DefenseMoneyGeneratedMode
  actionLens: DefenseMoneyActionLens
  summary: string
  soWhat: string
}

const ACTION_LENS_VALUES: DefenseMoneyActionLens[] = ['build', 'sell', 'partner']

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function actionLensFromText(value: string): DefenseMoneyActionLens {
  const text = compact(value).toLowerCase()

  if (/partner|teaming|alliances|supply chain/.test(text)) {
    return 'partner'
  }

  if (/capture|bid|contract|pipeline|award/.test(text)) {
    return 'sell'
  }

  return 'build'
}

function validateLlmPayload(payload: unknown, citationIds: Set<string>) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const asPayload = payload as Partial<LlmPayload>
  const actionLens = compact(asPayload.actionLens)

  if (!ACTION_LENS_VALUES.includes(actionLens as DefenseMoneyActionLens)) {
    return null
  }

  const summary = compact(asPayload.summary)
  const soWhat = compact(asPayload.soWhat)

  if (!summary || !soWhat) {
    return null
  }

  const claims = Array.isArray(asPayload.claims) ? asPayload.claims : []

  for (const claim of claims) {
    if (!claim || typeof claim !== 'object') {
      return null
    }

    const citationList = Array.isArray((claim as LlmClaim).citationIds)
      ? ((claim as LlmClaim).citationIds as string[]).map((entry) => compact(entry)).filter(Boolean)
      : []

    if (citationList.length === 0) {
      return null
    }

    if (!citationList.every((id) => citationIds.has(id))) {
      return null
    }
  }

  return {
    actionLens: actionLens as DefenseMoneyActionLens,
    summary,
    soWhat,
  }
}

async function callOpenAiForImplication(input: {
  model: string
  apiKey: string
  headline: string
  summary: string
  deterministicSoWhat: string
  citations: DefenseMoneyCitation[]
}) {
  const citationLines = input.citations
    .map((citation) => `- ${citation.id}: ${citation.label} (${citation.url})`)
    .join('\n')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.2,
      response_format: {
        type: 'json_object',
      },
      messages: [
        {
          role: 'system',
          content:
            'You are a defense-tech briefing analyst. Return strict JSON with fields: actionLens (build|sell|partner), summary, soWhat, claims[]. Every claim must contain citationIds with one or more provided citation IDs.',
        },
        {
          role: 'user',
          content: [
            `Headline: ${input.headline}`,
            `Summary: ${input.summary}`,
            `Deterministic fallback soWhat: ${input.deterministicSoWhat}`,
            'Allowed citations:',
            citationLines,
          ].join('\n\n'),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM implication request failed (${response.status}).`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string
      }
    }>
  }

  const content = compact(payload.choices?.[0]?.message?.content)

  if (!content) {
    throw new Error('LLM implication request returned empty content.')
  }

  let parsed: unknown = null

  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('LLM implication response was not valid JSON.')
  }

  const citationIds = new Set(input.citations.map((citation) => citation.id))
  const validated = validateLlmPayload(parsed, citationIds)

  if (!validated) {
    throw new Error('LLM implication payload failed citation validation.')
  }

  return validated
}

export async function generateGuardrailedImplication(input: {
  headline: string
  summary: string
  deterministicSoWhat: string
  citations: DefenseMoneyCitation[]
  model: string
  llmEnabled: boolean
}): Promise<GuardrailedImplicationResult> {
  const fallback: GuardrailedImplicationResult = {
    generatedMode: 'deterministic',
    actionLens: actionLensFromText(`${input.headline} ${input.summary} ${input.deterministicSoWhat}`),
    summary: compact(input.summary) || compact(input.headline),
    soWhat: compact(input.deterministicSoWhat) || compact(input.summary) || compact(input.headline),
  }

  if (!input.llmEnabled || input.citations.length === 0) {
    return fallback
  }

  const apiKey = compact(process.env.OPENAI_API_KEY)

  if (!apiKey) {
    return fallback
  }

  try {
    const generated = await callOpenAiForImplication({
      model: input.model,
      apiKey,
      headline: input.headline,
      summary: input.summary,
      deterministicSoWhat: input.deterministicSoWhat,
      citations: input.citations,
    })

    return {
      generatedMode: 'llm',
      actionLens: generated.actionLens,
      summary: generated.summary,
      soWhat: generated.soWhat,
    }
  } catch {
    return fallback
  }
}
