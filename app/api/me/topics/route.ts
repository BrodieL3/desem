import {NextResponse} from 'next/server'

import {createSupabaseServerClient} from '@/lib/supabase/server'
import {getAuthenticatedUser} from '@/lib/user/session'

type FollowRow = {
  topic_id: string
  topics: {
    id: string
    slug: string
    label: string
    topic_type: string
  } | Array<{
    id: string
    slug: string
    label: string
    topic_type: string
  }> | null
}

function asTopicType(value: string | undefined) {
  if (
    value === 'organization' ||
    value === 'program' ||
    value === 'technology' ||
    value === 'company' ||
    value === 'geography' ||
    value === 'acronym' ||
    value === 'person'
  ) {
    return value
  }

  return 'organization'
}

async function readFollows(userId: string) {
  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    return []
  }

  const {data} = await supabase
    .from('user_topic_follows')
    .select('topic_id, topics(id, slug, label, topic_type)')
    .eq('user_id', userId)
    .returns<FollowRow[]>()

  return (data ?? [])
    .map((row) => {
      const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics

      if (!topic) {
        return null
      }

      return {
        id: topic.id,
        slug: topic.slug,
        label: topic.label,
        topicType: asTopicType(topic.topic_type),
      }
    })
    .filter((topic): topic is NonNullable<typeof topic> => topic !== null)
    .sort((a, b) => a.label.localeCompare(b.label))
}

function parseTopicIdArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const deduped = new Set<string>()

  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const trimmed = item.trim()

    if (!trimmed) {
      continue
    }

    deduped.add(trimmed)
  }

  return [...deduped]
}

export async function GET() {
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const data = await readFollows(user.id)
  return NextResponse.json({data})
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    return NextResponse.json({error: 'Supabase is not configured.'}, {status: 500})
  }

  const payload = await request.json().catch(() => null)

  const action = typeof payload?.action === 'string' ? payload.action : null
  const topicId = typeof payload?.topicId === 'string' ? payload.topicId.trim() : ''

  if (action === 'follow' && topicId) {
    const {error} = await supabase.from('user_topic_follows').upsert(
      {
        user_id: user.id,
        topic_id: topicId,
      },
      {
        onConflict: 'user_id,topic_id',
      }
    )

    if (error) {
      return NextResponse.json({error: error.message}, {status: 400})
    }

    return NextResponse.json({data: await readFollows(user.id)})
  }

  if (action === 'unfollow' && topicId) {
    const {error} = await supabase.from('user_topic_follows').delete().eq('user_id', user.id).eq('topic_id', topicId)

    if (error) {
      return NextResponse.json({error: error.message}, {status: 400})
    }

    return NextResponse.json({data: await readFollows(user.id)})
  }

  const replacementTopicIds = parseTopicIdArray(payload?.topicIds)

  if (replacementTopicIds.length > 0 || Array.isArray(payload?.topicIds)) {
    const {error: deleteError} = await supabase.from('user_topic_follows').delete().eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json({error: deleteError.message}, {status: 400})
    }

    if (replacementTopicIds.length > 0) {
      const {error: insertError} = await supabase.from('user_topic_follows').insert(
        replacementTopicIds.map((id) => ({
          user_id: user.id,
          topic_id: id,
        }))
      )

      if (insertError) {
        return NextResponse.json({error: insertError.message}, {status: 400})
      }
    }

    return NextResponse.json({data: await readFollows(user.id)})
  }

  return NextResponse.json({error: 'Invalid request payload.'}, {status: 400})
}
