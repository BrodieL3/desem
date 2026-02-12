import {NextResponse} from 'next/server'

import {getAuthenticatedUser, upsertUserInterests} from '@/lib/user/interests'
import {createEmptyInterests, type UserInterestCollection} from '@/lib/user/types'

function sanitize(values: unknown) {
  if (!Array.isArray(values)) {
    return []
  }

  const seen = new Set<string>()
  const sanitized: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }

    const trimmed = value.trim()
    const key = trimmed.toLowerCase()

    if (!trimmed || seen.has(key)) {
      continue
    }

    seen.add(key)
    sanitized.push(trimmed)

    if (sanitized.length >= 50) {
      break
    }
  }

  return sanitized
}

function parsePayload(payload: unknown): UserInterestCollection {
  const base = createEmptyInterests()

  if (!payload || typeof payload !== 'object') {
    return base
  }

  const record = payload as Partial<Record<keyof UserInterestCollection, unknown>>

  return {
    mission: sanitize(record.mission),
    domain: sanitize(record.domain),
    tech: sanitize(record.tech),
  }
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const payload = await request.json().catch(() => null)
  const interests = parsePayload(payload)

  const result = await upsertUserInterests(user.id, interests)

  if (result.error) {
    return NextResponse.json({error: result.error}, {status: 400})
  }

  return NextResponse.json({data: result.data})
}
