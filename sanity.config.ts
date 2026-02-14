import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'

import {defaultDocumentNode, structure} from './sanity/lib/structure'
import {schemaTypes} from './sanity/schemaTypes'

const processEnv = typeof process !== 'undefined' ? process.env : {}
const studioEnv = (import.meta as {env?: Record<string, string | undefined>}).env ?? {}

const projectId =
  studioEnv.SANITY_STUDIO_PROJECT_ID ??
  studioEnv.NEXT_PUBLIC_SANITY_PROJECT_ID ??
  processEnv.SANITY_STUDIO_PROJECT_ID ??
  processEnv.SANITY_PROJECT_ID ??
  processEnv.NEXT_PUBLIC_SANITY_PROJECT_ID ??
  undefined

const dataset =
  studioEnv.SANITY_STUDIO_DATASET ??
  studioEnv.NEXT_PUBLIC_SANITY_DATASET ??
  processEnv.SANITY_STUDIO_DATASET ??
  processEnv.SANITY_DATASET ??
  processEnv.NEXT_PUBLIC_SANITY_DATASET ??
  'production'

if (!projectId) {
  throw new Error(
    'Missing Sanity project ID. Set SANITY_STUDIO_PROJECT_ID, SANITY_PROJECT_ID, or NEXT_PUBLIC_SANITY_PROJECT_ID.',
  )
}

export default defineConfig({
  name: 'default',
  title: 'Field Brief Studio',
  projectId,
  dataset,
  plugins: [
    structureTool({
      structure,
      defaultDocumentNode,
    }),
  ],
  vite: (viteConfig) => {
    const currentEnvPrefix = viteConfig.envPrefix ?? 'VITE_'
    const envPrefixes = Array.isArray(currentEnvPrefix) ? currentEnvPrefix : [currentEnvPrefix]

    return {
      ...viteConfig,
      envPrefix: Array.from(new Set([...envPrefixes, 'SANITY_STUDIO_', 'NEXT_PUBLIC_'])),
    }
  },
  schema: {
    types: schemaTypes,
  },
})
