import {createServerClient} from '@supabase/ssr'
import {type NextRequest, NextResponse} from 'next/server'

import {getSupabaseEnv} from './env'

export async function updateSupabaseSession(request: NextRequest) {
  const env = getSupabaseEnv()

  if (!env) {
    return NextResponse.next({request})
  }

  let response = NextResponse.next({request})

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookieValues) {
        cookieValues.forEach(({name, value}) => {
          request.cookies.set(name, value)
        })

        response = NextResponse.next({request})

        cookieValues.forEach(({name, value, options}) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  await supabase.auth.getUser()

  return response
}
