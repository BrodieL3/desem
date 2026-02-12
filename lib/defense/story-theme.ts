import type {BriefingTrack} from '@/lib/defense/constants'

type StoryTrack = Exclude<BriefingTrack, 'all'>

type DomainVisualTheme = {
  gradientClass: string
  badgeClass: string
}

const fallbackDomainTheme: DomainVisualTheme = {
  gradientClass: 'from-slate-800 via-slate-700 to-slate-500',
  badgeClass: 'border-white/35 bg-white/10 text-white',
}

const domainThemes: Record<string, DomainVisualTheme> = {
  land: {
    gradientClass: 'from-emerald-900 via-emerald-700 to-lime-500',
    badgeClass: 'border-lime-200/50 bg-lime-200/15 text-lime-50',
  },
  air: {
    gradientClass: 'from-sky-900 via-cyan-700 to-cyan-500',
    badgeClass: 'border-cyan-100/50 bg-cyan-100/15 text-cyan-50',
  },
  maritime: {
    gradientClass: 'from-blue-900 via-blue-700 to-teal-500',
    badgeClass: 'border-teal-100/50 bg-teal-100/15 text-teal-50',
  },
  space: {
    gradientClass: 'from-indigo-950 via-violet-800 to-fuchsia-600',
    badgeClass: 'border-violet-100/50 bg-violet-100/15 text-violet-50',
  },
  cyber: {
    gradientClass: 'from-zinc-900 via-zinc-700 to-cyan-600',
    badgeClass: 'border-cyan-100/45 bg-cyan-100/10 text-cyan-50',
  },
  'multi-domain': {
    gradientClass: 'from-rose-900 via-orange-700 to-amber-500',
    badgeClass: 'border-amber-100/45 bg-amber-100/15 text-amber-50',
  },
}

const trackAccentClasses: Record<StoryTrack, string> = {
  macro: 'border-l-rose-500',
  programs: 'border-l-amber-500',
  tech: 'border-l-cyan-500',
  capital: 'border-l-indigo-500',
}

const trackPillClasses: Record<StoryTrack, string> = {
  macro: 'border-rose-200 bg-rose-50 text-rose-700',
  programs: 'border-amber-200 bg-amber-50 text-amber-700',
  tech: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  capital: 'border-indigo-200 bg-indigo-50 text-indigo-700',
}

export function getDomainVisualTheme(domain: string): DomainVisualTheme {
  return domainThemes[domain] ?? fallbackDomainTheme
}

export function getTrackAccentClass(track: StoryTrack): string {
  return trackAccentClasses[track]
}

export function getTrackPillClass(track: StoryTrack): string {
  return trackPillClasses[track]
}
