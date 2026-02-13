import {createClient} from '@supabase/supabase-js'

export function getSupabaseAdminEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  return {
    url,
    serviceRoleKey,
  }
}

export function createSupabaseAdminClientFromEnv() {
  const env = getSupabaseAdminEnv()

  if (!env) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin operations.')
  }

  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function createOptionalSupabaseAdminClientFromEnv() {
  const env = getSupabaseAdminEnv()

  if (!env) {
    return null
  }

  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
