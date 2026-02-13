import type {User} from '@supabase/supabase-js'

import {createSupabaseServerClient} from '@/lib/supabase/server'

export type UserSession = {
  userId: string | null
  email: string | null
  isAuthenticated: boolean
}

export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    return null
  }

  const {
    data: {user},
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function getUserSession(): Promise<UserSession> {
  const user = await getAuthenticatedUser()

  if (!user) {
    return {
      userId: null,
      email: null,
      isAuthenticated: false,
    }
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    isAuthenticated: true,
  }
}
