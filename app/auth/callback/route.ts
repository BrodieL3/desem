import type {EmailOtpType} from '@supabase/supabase-js'
import {type NextRequest, NextResponse} from 'next/server'

import {createSupabaseServerClient} from '@/lib/supabase/server'

function resolveNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith('/')) {
    return '/'
  }

  return nextPath
}

function signInRedirect(request: NextRequest, reason: string, nextPath: string) {
  const redirectUrl = new URL('/auth/sign-in', request.url)
  redirectUrl.searchParams.set('error', reason)
  redirectUrl.searchParams.set('next', nextPath)
  return NextResponse.redirect(redirectUrl)
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const nextPath = resolveNextPath(requestUrl.searchParams.get('next'))
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')

  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    return signInRedirect(request, 'Supabase environment variables are missing.', nextPath)
  }

  let authError: string | null = null

  if (code) {
    const {error} = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      authError = error.message
    }
  } else if (tokenHash && type) {
    const {error} = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    })

    if (error) {
      authError = error.message
    }
  } else {
    authError = 'Missing auth callback parameters.'
  }

  if (authError) {
    return signInRedirect(request, authError, nextPath)
  }

  const {
    data: {user},
  } = await supabase.auth.getUser()

  if (!user) {
    return signInRedirect(request, 'Authentication failed. Please try again.', nextPath)
  }

  await supabase.from('profiles').upsert({id: user.id}, {onConflict: 'id'})

  const {data: profile} = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle<{onboarding_completed_at: string | null}>()

  if (!profile?.onboarding_completed_at && nextPath !== '/onboarding') {
    const onboardingUrl = new URL('/onboarding', request.url)

    if (nextPath !== '/') {
      onboardingUrl.searchParams.set('next', nextPath)
    }

    return NextResponse.redirect(onboardingUrl)
  }

  const redirectUrl = new URL(nextPath, request.url)
  return NextResponse.redirect(redirectUrl)
}
