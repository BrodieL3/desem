export const interestTypeValues = ['mission', 'domain', 'tech'] as const

export type InterestType = (typeof interestTypeValues)[number]

export type UserInterest = {
  interestType: InterestType
  interestValue: string
}

export type UserInterestCollection = Record<InterestType, string[]>

export type UserProfileRow = {
  id: string
  onboarding_completed_at: string | null
  created_at?: string
  updated_at?: string
}

export type UserPersonalizationContext = {
  userId: string | null
  email: string | null
  isAuthenticated: boolean
  profile: UserProfileRow | null
  onboardingCompleted: boolean
  interests: UserInterestCollection
}

export function createEmptyInterests(): UserInterestCollection {
  return {
    mission: [],
    domain: [],
    tech: [],
  }
}

export function hasAnyInterests(interests: UserInterestCollection) {
  return interests.mission.length > 0 || interests.domain.length > 0 || interests.tech.length > 0
}
