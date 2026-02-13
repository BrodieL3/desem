import {createClient, type SanityClient} from '@sanity/client'

export type SanityServerEnv = {
  projectId: string
  dataset: string
  apiVersion: string
  token: string | null
  schemaId: string | null
}

function readProjectId() {
  return process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || null
}

function readDataset() {
  return process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || null
}

export function getSanityServerEnv(): SanityServerEnv | null {
  const projectId = readProjectId()
  const dataset = readDataset()

  if (!projectId || !dataset) {
    return null
  }

  return {
    projectId,
    dataset,
    apiVersion: process.env.SANITY_API_VERSION || 'vX',
    token: process.env.SANITY_AGENT_TOKEN ?? null,
    schemaId: process.env.SANITY_SCHEMA_ID ?? null,
  }
}

export function createOptionalSanityServerClient() {
  const env = getSanityServerEnv()

  if (!env) {
    return null
  }

  return createClient({
    projectId: env.projectId,
    dataset: env.dataset,
    apiVersion: env.apiVersion,
    token: env.token ?? undefined,
    useCdn: false,
    perspective: 'raw',
  })
}

export function createSanityWriteClientFromEnv(): {
  client: SanityClient
  schemaId: string
} {
  const env = getSanityServerEnv()

  if (!env) {
    throw new Error('Missing SANITY_PROJECT_ID/SANITY_DATASET (or NEXT_PUBLIC_SANITY_* fallbacks).')
  }

  if (!env.token) {
    throw new Error('Missing SANITY_AGENT_TOKEN for Sanity write operations.')
  }

  if (!env.schemaId) {
    throw new Error('Missing SANITY_SCHEMA_ID for Transform operations.')
  }

  const client = createClient({
    projectId: env.projectId,
    dataset: env.dataset,
    apiVersion: env.apiVersion,
    token: env.token,
    useCdn: false,
    perspective: 'raw',
  })

  return {
    client,
    schemaId: env.schemaId,
  }
}
