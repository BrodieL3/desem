'use client'

import {createBrowserClient} from '@supabase/ssr'
import type {SupabaseClient} from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

function getBrowserEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !publishableKey) {
    return null
  }

  return {
    url,
    publishableKey,
  }
}

export function createSupabaseBrowserClient() {
  const env = getBrowserEnv()

  if (!env) {
    return null
  }

  if (!browserClient) {
    browserClient = createBrowserClient(env.url, env.publishableKey)
  }

  return browserClient
}
