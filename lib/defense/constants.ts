export const stationValues = ['founder', 'prime_pm', 'investor', 'policy'] as const
export type Station = (typeof stationValues)[number]

export const defaultStation: Station = 'founder'

export const stationLabels: Record<Station, string> = {
  founder: 'Founder / BD',
  prime_pm: 'Prime PM / Capture',
  investor: 'Investor',
  policy: 'Policy / Staff',
}

export const stationDescriptions: Record<Station, string> = {
  founder: 'On-ramps, teaming paths, and near-term procurement motion.',
  prime_pm: 'Capture posture, execution risk, and probable program structure.',
  investor: 'Demand durability, growth timing, and downside risk signals.',
  policy: 'Strategic alignment, appropriation pressure, and posture implications.',
}

export const briefingTrackValues = ['all', 'macro', 'programs', 'tech', 'capital'] as const
export type BriefingTrack = (typeof briefingTrackValues)[number]

export const briefingTrackLabels: Record<BriefingTrack, string> = {
  all: 'All',
  macro: 'Macro & conflicts',
  programs: 'Programs & contracts',
  tech: 'Tech & innovation',
  capital: 'Capital & funding',
}

export const quickFilterValues = ['all', 'my-missions', 'budget', 'programs', 'funding'] as const
export type QuickFilter = (typeof quickFilterValues)[number]

export const quickFilterLabels: Record<QuickFilter, string> = {
  all: 'All',
  'my-missions': 'My missions',
  budget: 'Budget',
  programs: 'Programs',
  funding: 'Funding',
}

export const defaultMissionsByStation: Record<Station, string[]> = {
  founder: ['Counter-UAS', 'Joint C2', 'Resilient Comms'],
  prime_pm: ['Industrial Base', 'Munitions', 'Joint C2'],
  investor: ['Defense Software', 'Autonomy', 'Industrial Base'],
  policy: ['Deterrence', 'Industrial Base', 'Force Protection'],
}

export function isStation(value: string | null | undefined): value is Station {
  return value !== undefined && value !== null && stationValues.includes(value as Station)
}

export function isBriefingTrack(value: string | null | undefined): value is BriefingTrack {
  return value !== undefined && value !== null && briefingTrackValues.includes(value as BriefingTrack)
}

export function isQuickFilter(value: string | null | undefined): value is QuickFilter {
  return value !== undefined && value !== null && quickFilterValues.includes(value as QuickFilter)
}
