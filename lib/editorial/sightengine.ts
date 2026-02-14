const SIGHTENGINE_GENAI_ENDPOINT = 'https://api.sightengine.com/1.0/check.json'
const DEFAULT_AI_GENERATED_THRESHOLD = 0.5

export type ImageGenAiAssessment = {
  shouldDisplay: boolean
  aiGeneratedScore: number | null
}

type SightengineGenAiResponse = {
  status?: string
  type?: {
    ai_generated?: number
  } | null
}

const assessmentCache = new Map<string, ImageGenAiAssessment>()
const inFlightVisibilityChecks = new Map<string, Promise<ImageGenAiAssessment>>()
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

function resolveAiGeneratedThreshold() {
  const configured = process.env.SIGHTENGINE_AI_GENERATED_THRESHOLD

  if (!configured) {
    return DEFAULT_AI_GENERATED_THRESHOLD
  }

  const parsed = Number.parseFloat(configured)

  if (!Number.isFinite(parsed)) {
    return DEFAULT_AI_GENERATED_THRESHOLD
  }

  return Math.min(1, Math.max(0, parsed))
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

async function fetchAiGeneratedScore(input: {
  imageUrl: string
  apiUser: string
  apiSecret: string
}) {
  const params = new URLSearchParams({
    models: 'genai',
    api_user: input.apiUser,
    api_secret: input.apiSecret,
    url: input.imageUrl,
  })

  const response = await fetch(`${SIGHTENGINE_GENAI_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as SightengineGenAiResponse

  if (payload.status !== 'success') {
    return null
  }

  const score = payload.type?.ai_generated

  if (!Number.isFinite(score)) {
    return null
  }

  return Math.min(1, Math.max(0, Number(score)))
}

export async function shouldDisplayNonAiImageUrl(imageUrl: string | null | undefined) {
  const assessment = await getImageGenAiAssessment(imageUrl)
  return assessment.shouldDisplay
}

export async function getImageGenAiAssessment(imageUrl: string | null | undefined): Promise<ImageGenAiAssessment> {
  const normalizedImageUrl = normalizeImageUrl(imageUrl)

  if (!normalizedImageUrl) {
    return {
      shouldDisplay: false,
      aiGeneratedScore: null,
    }
  }

  const cachedAssessment = assessmentCache.get(normalizedImageUrl)

  if (cachedAssessment) {
    return cachedAssessment
  }

  const inFlight = inFlightVisibilityChecks.get(normalizedImageUrl)

  if (inFlight) {
    return inFlight
  }

  const checkPromise: Promise<ImageGenAiAssessment> = (async () => {
    const credentials = resolveCredentials()

    if (!credentials) {
      if (!hasLoggedMissingCredentials) {
        hasLoggedMissingCredentials = true
        console.warn('[editorial-ui]', {
          event: 'image_genai_filter_credentials_missing',
          message:
            'NEXT_PUBLIC_SIGHTENGINE_API_KEY and NEXT_PUBLIC_SIGHTENGINE_API_SECRET are required to verify images.',
        })
      }

      const assessment: ImageGenAiAssessment = {
        shouldDisplay: false,
        aiGeneratedScore: null,
      }
      assessmentCache.set(normalizedImageUrl, assessment)
      return assessment
    }

    try {
      const score = await fetchAiGeneratedScore({
        imageUrl: normalizedImageUrl,
        apiUser: credentials.apiUser,
        apiSecret: credentials.apiSecret,
      })

      if (typeof score !== 'number') {
        const assessment: ImageGenAiAssessment = {
          shouldDisplay: false,
          aiGeneratedScore: null,
        }
        assessmentCache.set(normalizedImageUrl, assessment)
        return assessment
      }

      const assessment: ImageGenAiAssessment = {
        shouldDisplay: score < resolveAiGeneratedThreshold(),
        aiGeneratedScore: score,
      }
      assessmentCache.set(normalizedImageUrl, assessment)
      return assessment
    } catch (error) {
      console.warn('[editorial-ui]', {
        event: 'image_genai_filter_failed',
        imageUrl: normalizedImageUrl,
        message: error instanceof Error ? error.message : 'Unknown Sightengine error',
      })
      const assessment: ImageGenAiAssessment = {
        shouldDisplay: false,
        aiGeneratedScore: null,
      }
      assessmentCache.set(normalizedImageUrl, assessment)
      return assessment
    }
  })()

  inFlightVisibilityChecks.set(normalizedImageUrl, checkPromise)

  try {
    return await checkPromise
  } finally {
    inFlightVisibilityChecks.delete(normalizedImageUrl)
  }
}

export function __resetSightengineCacheForTests() {
  assessmentCache.clear()
  inFlightVisibilityChecks.clear()
  hasLoggedMissingCredentials = false
}
