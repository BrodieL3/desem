import {type NextRequest, NextResponse} from 'next/server'

import {createSupabaseServerClient} from '@/lib/supabase/server'

async function signOut(request: NextRequest) {
  const supabase = await createSupabaseServerClient()

  if (supabase) {
    await supabase.auth.signOut()
  }

  return NextResponse.redirect(new URL('/', request.url), {status: 303})
}

export async function GET(request: NextRequest) {
  return signOut(request)
}

export async function POST(request: NextRequest) {
  return signOut(request)
}
