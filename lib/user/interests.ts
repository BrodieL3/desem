import type {User} from '@supabase/supabase-js'

import type {DefenseSemaformStory} from '@/lib/defense/types'
import {createSupabaseServerClient} from '@/lib/supabase/server'

import {
  createEmptyInterests,
  interestTypeValues,
  type InterestType,
  type UserInterestCollection,
  type UserPersonalizationContext,
  type UserProfileRow,
} from './types'

type UserInterestRow = {
  interest_type: InterestType
  interest_value: string
}

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>
type PostgrestLikeError = {
  code?: string | null
  message: string
}

const personalizationMigrationPath = 'db/migrations/202602120001_interest_first_personalization.sql'
const personalizationSchemaMissingMessage =
  `Supabase personalization tables are missing. Apply ${personalizationMigrationPath} in the Supabase SQL editor, then retry.`

function isSchemaCacheTableError(error: PostgrestLikeError | null | undefined) {
  if (!error) {
    return false
  }

  if (error.code === 'PGRST205') {
    return true
  }

  const message = error.message.toLowerCase()
  return message.includes('schema cache') && message.includes('could not find the table')
}

function getUserSafeErrorMessage(error: PostgrestLikeError | null | undefined) {
  if (!error) {
    return 'Unexpected database error.'
  }

  if (isSchemaCacheTableError(error)) {
    return personalizationSchemaMissingMessage
  }

  return error.message
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase()
}

function dedupeValues(values: string[]) {
  const deduped: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    const normalized = value.trim()
    const key = normalizeKey(normalized)

    if (!normalized || seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(normalized)
  }

  return deduped
}

function normalizeInterests(interests: Partial<UserInterestCollection> | null | undefined): UserInterestCollection {
  const empty = createEmptyInterests()

  if (!interests) {
    return empty
  }

  return {
    mission: dedupeValues(interests.mission ?? []),
    domain: dedupeValues(interests.domain ?? []),
    tech: dedupeValues(interests.tech ?? []),
  }
}

function buildInterestRows(userId: string, interests: UserInterestCollection) {
  const rows: Array<{user_id: string; interest_type: InterestType; interest_value: string}> = []

  for (const interestType of interestTypeValues) {
    for (const interestValue of interests[interestType]) {
      rows.push({
        user_id: userId,
        interest_type: interestType,
        interest_value: interestValue,
      })
    }
  }

  return rows
}

async function getUserInterestsWithClient(
  supabase: SupabaseServerClient,
  userId: string
): Promise<UserInterestCollection> {
  const {data, error} = await supabase
    .from('user_interests')
    .select('interest_type, interest_value')
    .eq('user_id', userId)
    .returns<UserInterestRow[]>()

  if (error || !data) {
    return createEmptyInterests()
  }

  const grouped = createEmptyInterests()

  for (const row of data) {
    grouped[row.interest_type].push(row.interest_value)
  }

  return normalizeInterests(grouped)
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

export async function getUserInterests(userId: string): Promise<UserInterestCollection> {
  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    return createEmptyInterests()
  }

  return getUserInterestsWithClient(supabase, userId)
}

export async function upsertUserInterests(userId: string, interests: Partial<UserInterestCollection>) {
  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    return {
      data: createEmptyInterests(),
      error: 'Supabase environment variables are missing.',
    }
  }

  const normalizedInterests = normalizeInterests(interests)

  const {error: profileError} = await supabase.from('profiles').upsert({id: userId}, {onConflict: 'id'})

  if (profileError) {
    return {
      data: normalizedInterests,
      error: getUserSafeErrorMessage(profileError),
    }
  }

  const {error: deleteError} = await supabase.from('user_interests').delete().eq('user_id', userId)

  if (deleteError) {
    return {
      data: normalizedInterests,
      error: getUserSafeErrorMessage(deleteError),
    }
  }

  const rows = buildInterestRows(userId, normalizedInterests)

  if (rows.length > 0) {
    const {error: insertError} = await supabase.from('user_interests').insert(rows)

    if (insertError) {
      return {
        data: normalizedInterests,
        error: getUserSafeErrorMessage(insertError),
      }
    }
  }

  const {error: completionError} = await supabase
    .from('profiles')
    .update({onboarding_completed_at: new Date().toISOString()})
    .eq('id', userId)

  if (completionError) {
    return {
      data: normalizedInterests,
      error: getUserSafeErrorMessage(completionError),
    }
  }

  return {
    data: normalizedInterests,
    error: null,
  }
}

export function computeStoryPersonalizationScore(story: DefenseSemaformStory, interests: UserInterestCollection) {
  const missionSet = new Set(interests.mission.map(normalizeKey))
  const domainSet = new Set(interests.domain.map(normalizeKey))
  const techSet = new Set(interests.tech.map(normalizeKey))

  const missionMatches = story.missionTags.reduce((count, mission) => count + Number(missionSet.has(normalizeKey(mission))), 0)
  const domainMatches = Number(domainSet.has(normalizeKey(story.domain)))
  const techMatches = story.technologyTags.reduce((count, tech) => count + Number(techSet.has(normalizeKey(tech))), 0)
  const highImpactBonus = story.highImpact ? 1 : 0

  return missionMatches * 3 + domainMatches * 2 + techMatches + highImpactBonus
}

export async function getUserPersonalizationContext(): Promise<UserPersonalizationContext> {
  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    return {
      userId: null,
      email: null,
      isAuthenticated: false,
      profile: null,
      onboardingCompleted: false,
      interests: createEmptyInterests(),
    }
  }

  const {
    data: {user},
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      userId: null,
      email: null,
      isAuthenticated: false,
      profile: null,
      onboardingCompleted: false,
      interests: createEmptyInterests(),
    }
  }

  await supabase.from('profiles').upsert({id: user.id}, {onConflict: 'id'})

  const [profileResult, interests] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, onboarding_completed_at, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle<UserProfileRow>(),
    getUserInterestsWithClient(supabase, user.id),
  ])

  const profile = profileResult.data ?? null

  return {
    userId: user.id,
    email: user.email ?? null,
    isAuthenticated: true,
    profile,
    onboardingCompleted: Boolean(profile?.onboarding_completed_at),
    interests,
  }
}
