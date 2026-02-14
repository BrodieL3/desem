const SIGHTENGINE_ENDPOINT = 'https://api.sightengine.com/1.0/check.json'
const DEFAULT_AI_GENERATED_THRESHOLD = 0.5
const DEFAULT_QUALITY_THRESHOLD = 0.4
const DEFAULT_RELEVANCE_THRESHOLD = 0.35

export type ImageDisplayAssessment = {
  shouldDisplay: boolean
  aiGeneratedScore: number | null
  qualityScore: number | null
  relevanceScore: number
  reasons: string[]
}

export type ImageGenAiAssessment = {
  shouldDisplay: boolean
  aiGeneratedScore: number | null
}

type SightengineResponse = {
  status?: string
  type?: {
    ai_generated?: number
  } | null
  quality?: {
    score?: number
  } | null
}

type SightengineSignals = {
  aiGeneratedScore: number | null
  qualityScore: number | null
}

const signalCache = new Map<string, SightengineSignals>()
const inFlightSignalChecks = new Map<string, Promise<SightengineSignals>>()
let hasLoggedMissingCredentials = false

function resolveCredentials() {
  const apiUser = process.env.NEXT_PUBLIC_SIGHTENGINE_API_KEY?.trim()
  const apiSecret = process.env.NEXT_PUBLIC_SIGHTENGINE_API_SECRET?.trim()

  if (!apiUser || !apiSecret) {
    return null
  }

  return {
    apiUser,
    apiSecret,
  }
}

function clampScore(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return Math.min(1, Math.max(0, value))
}

function resolveAiGeneratedThreshold() {
  const configured = process.env.SIGHTENGINE_AI_GENERATED_THRESHOLD

  if (!configured) {
    return DEFAULT_AI_GENERATED_THRESHOLD
  }

  const parsed = Number.parseFloat(configured)
  return clampScore(parsed) ?? DEFAULT_AI_GENERATED_THRESHOLD
}

function resolveQualityThreshold() {
  const configured = process.env.SIGHTENGINE_IMAGE_QUALITY_THRESHOLD

  if (!configured) {
    return DEFAULT_QUALITY_THRESHOLD
  }

  const parsed = Number.parseFloat(configured)
  return clampScore(parsed) ?? DEFAULT_QUALITY_THRESHOLD
}

function resolveRelevanceThreshold() {
  const configured = process.env.SIGHTENGINE_RELEVANCE_THRESHOLD

  if (!configured) {
    return DEFAULT_RELEVANCE_THRESHOLD
  }

  const parsed = Number.parseFloat(configured)
  return clampScore(parsed) ?? DEFAULT_RELEVANCE_THRESHOLD
}

function normalizeImageUrl(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  try {
    return new URL(trimmed).toString()
  } catch {
    return null
  }
}

async function fetchImageSignals(input: {
  imageUrl: string
  apiUser: string
  apiSecret: string
}): Promise<SightengineSignals> {
  const params = new URLSearchParams({
    models: 'genai,quality',
    api_user: input.apiUser,
    api_secret: input.apiSecret,
    url: input.imageUrl,
  })

  const response = await fetch(`${SIGHTENGINE_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    return {
      aiGeneratedScore: null,
      qualityScore: null,
    }
  }

  const payload = (await response.json()) as SightengineResponse

  if (payload.status !== 'success') {
    return {
      aiGeneratedScore: null,
      qualityScore: null,
    }
  }

  return {
    aiGeneratedScore: clampScore(payload.type?.ai_generated),
    qualityScore: clampScore(payload.quality?.score),
  }
}

async function getImageSignals(imageUrl: string | null | undefined): Promise<SightengineSignals> {
  const normalizedImageUrl = normalizeImageUrl(imageUrl)

  if (!normalizedImageUrl) {
    return {
      aiGeneratedScore: null,
      qualityScore: null,
    }
  }

  const cached = signalCache.get(normalizedImageUrl)

  if (cached) {
    return cached
  }

  const inFlight = inFlightSignalChecks.get(normalizedImageUrl)

  if (inFlight) {
    return inFlight
  }

  const checkPromise: Promise<SightengineSignals> = (async () => {
    const credentials = resolveCredentials()

    if (!credentials) {
      if (!hasLoggedMissingCredentials) {
        hasLoggedMissingCredentials = true
        console.warn('[editorial-ui]', {
          event: 'image_quality_filter_credentials_missing',
          message:
            'NEXT_PUBLIC_SIGHTENGINE_API_KEY and NEXT_PUBLIC_SIGHTENGINE_API_SECRET are required to verify images.',
        })
      }

      const emptySignals: SightengineSignals = {
        aiGeneratedScore: null,
        qualityScore: null,
      }

      signalCache.set(normalizedImageUrl, emptySignals)
      return emptySignals
    }

    try {
      const signals = await fetchImageSignals({
        imageUrl: normalizedImageUrl,
        apiUser: credentials.apiUser,
        apiSecret: credentials.apiSecret,
      })

      signalCache.set(normalizedImageUrl, signals)
      return signals
    } catch (error) {
      console.warn('[editorial-ui]', {
        event: 'image_quality_filter_failed',
        imageUrl: normalizedImageUrl,
        message: error instanceof Error ? error.message : 'Unknown Sightengine error',
      })

      const emptySignals: SightengineSignals = {
        aiGeneratedScore: null,
        qualityScore: null,
      }

      signalCache.set(normalizedImageUrl, emptySignals)
      return emptySignals
    }
  })()

  inFlightSignalChecks.set(normalizedImageUrl, checkPromise)

  try {
    return await checkPromise
  } finally {
    inFlightSignalChecks.delete(normalizedImageUrl)
  }
}

export async function getImageDisplayAssessment(input: {
  imageUrl: string | null | undefined
  relevanceScore?: number | null
}): Promise<ImageDisplayAssessment> {
  const normalizedImageUrl = normalizeImageUrl(input.imageUrl)
  const relevanceScore = clampScore(input.relevanceScore ?? 1) ?? 0

  if (!normalizedImageUrl) {
    return {
      shouldDisplay: false,
      aiGeneratedScore: null,
      qualityScore: null,
      relevanceScore,
      reasons: ['invalid_url'],
    }
  }

  const signals = await getImageSignals(normalizedImageUrl)
  const reasons: string[] = []

  if (typeof signals.aiGeneratedScore !== 'number') {
    reasons.push('missing_ai_score')
  } else if (signals.aiGeneratedScore >= resolveAiGeneratedThreshold()) {
    reasons.push('ai_generated')
  }

  if (typeof signals.qualityScore !== 'number') {
    reasons.push('missing_quality_score')
  } else if (signals.qualityScore < resolveQualityThreshold()) {
    reasons.push('low_quality')
  }

  if (relevanceScore < resolveRelevanceThreshold()) {
    reasons.push('low_relevance')
  }

  return {
    shouldDisplay: reasons.length === 0,
    aiGeneratedScore: signals.aiGeneratedScore,
    qualityScore: signals.qualityScore,
    relevanceScore,
    reasons,
  }
}

export async function shouldDisplayNonAiImageUrl(imageUrl: string | null | undefined) {
  const assessment = await getImageDisplayAssessment({
    imageUrl,
    relevanceScore: 1,
  })
  return assessment.shouldDisplay
}

export async function getImageGenAiAssessment(imageUrl: string | null | undefined): Promise<ImageGenAiAssessment> {
  const assessment = await getImageDisplayAssessment({
    imageUrl,
    relevanceScore: 1,
  })

  return {
    shouldDisplay: assessment.shouldDisplay,
    aiGeneratedScore: assessment.aiGeneratedScore,
  }
}

export function __resetSightengineCacheForTests() {
  signalCache.clear()
  inFlightSignalChecks.clear()
  hasLoggedMissingCredentials = false
}
