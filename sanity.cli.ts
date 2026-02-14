import {loadEnvConfig} from '@next/env'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {defineCliConfig} from 'sanity/cli'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
loadEnvConfig(rootDir)

const projectId = process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.SANITY_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'

export default defineCliConfig({
  ...(projectId
    ? {
        api: {
          projectId,
          dataset,
        },
      }
    : {}),
  vite: (viteConfig) => {
    const currentEnvPrefix = viteConfig.envPrefix ?? 'VITE_'
    const envPrefixes = Array.isArray(currentEnvPrefix) ? currentEnvPrefix : [currentEnvPrefix]

    return {
      ...viteConfig,
      envPrefix: Array.from(new Set([...envPrefixes, 'SANITY_STUDIO_', 'NEXT_PUBLIC_'])),
    }
  },
})
