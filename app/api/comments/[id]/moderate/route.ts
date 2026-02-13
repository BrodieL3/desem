import {NextResponse} from 'next/server'

import {createSupabaseAdminClientFromEnv} from '@/lib/supabase/admin'
import {createSupabaseServerClient} from '@/lib/supabase/server'
import {getAuthenticatedUser} from '@/lib/user/session'

type RouteContext = {
  params: Promise<{id: string}>
}

export async function PUT(request: Request, context: RouteContext) {
  const {id} = await context.params
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    return NextResponse.json({error: 'Supabase is not configured.'}, {status: 500})
  }

  const {data: profile} = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{role: string | null}>()

  if (profile?.role !== 'moderator') {
    return NextResponse.json({error: 'Forbidden'}, {status: 403})
  }

  const payload = await request.json().catch(() => null)
  const status = payload?.status === 'active' || payload?.status === 'hidden' ? payload.status : null

  if (!status) {
    return NextResponse.json({error: 'Status must be active or hidden.'}, {status: 400})
  }

  const admin = createSupabaseAdminClientFromEnv()
  const {error} = await admin.from('article_comments').update({status}).eq('id', id)

  if (error) {
    return NextResponse.json({error: error.message}, {status: 400})
  }

  return NextResponse.json({ok: true})
}
