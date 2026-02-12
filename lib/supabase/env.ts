export type SupabaseEnv = {
  url: string
  publishableKey: string
}

function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = getSupabasePublishableKey()

  if (!url || !publishableKey) {
    return null
  }

  return {
    url,
    publishableKey,
  }
}
