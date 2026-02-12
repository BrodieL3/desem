'use client'

import {useMemo, useState} from 'react'
import {useRouter} from 'next/navigation'

import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {cn} from '@/lib/utils'
import type {UserInterestCollection} from '@/lib/user/types'

type InterestFacetOptions = {
  missionTags: string[]
  domains: string[]
  technologyTags: string[]
}

type InterestsEditorProps = {
  mode: 'onboarding' | 'settings'
  options: InterestFacetOptions
  initialInterests: UserInterestCollection
  nextPath?: string
}

const onboardingSteps = [
  {
    id: 'mission' as const,
    label: 'Mission interests',
    description: 'Pick the missions you care about most.',
  },
  {
    id: 'domain' as const,
    label: 'Domain interests',
    description: 'Choose operating domains to prioritize.',
  },
  {
    id: 'tech' as const,
    label: 'Technology interests',
    description: 'Select technologies to emphasize.',
  },
  {
    id: 'confirm' as const,
    label: 'Confirm',
    description: 'Review and save your profile.',
  },
]

function dedupe(values: string[]) {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const value of values) {
    const normalized = value.trim()
    const key = normalized.toLowerCase()

    if (!normalized || seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(normalized)
  }

  return deduped
}

function normalizeInterests(interests: UserInterestCollection): UserInterestCollection {
  return {
    mission: dedupe(interests.mission),
    domain: dedupe(interests.domain),
    tech: dedupe(interests.tech),
  }
}

function InterestChips({
  values,
  selectedValues,
  onToggle,
}: {
  values: string[]
  selectedValues: string[]
  onToggle: (value: string) => void
}) {
  if (values.length === 0) {
    return <p className="text-muted-foreground text-sm">No options available in story corpus yet.</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => {
        const isSelected = selectedValues.includes(value)

        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              isSelected
                ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-[var(--brand)]'
            )}
          >
            {value}
          </button>
        )
      })}
    </div>
  )
}

export function InterestsEditor({mode, options, initialInterests, nextPath = '/'}: InterestsEditorProps) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [interests, setInterests] = useState<UserInterestCollection>(normalizeInterests(initialInterests))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalSelections = interests.mission.length + interests.domain.length + interests.tech.length
  const isOnboarding = mode === 'onboarding'

  const canAdvance = useMemo(() => {
    if (!isOnboarding) {
      return true
    }

    if (stepIndex === 0) {
      return interests.mission.length > 0
    }

    if (stepIndex === 1) {
      return interests.domain.length > 0
    }

    if (stepIndex === 2) {
      return interests.tech.length > 0
    }

    return true
  }, [interests.domain.length, interests.mission.length, interests.tech.length, isOnboarding, stepIndex])

  function toggleInterest(type: keyof UserInterestCollection, value: string) {
    setInterests((current) => {
      const values = current[type]
      const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value]

      return {
        ...current,
        [type]: nextValues,
      }
    })
  }

  async function saveInterests() {
    setIsSaving(true)
    setError(null)

    const response = await fetch('/api/user/interests', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(interests),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {error?: string} | null
      setError(payload?.error || 'Unable to save interests.')
      setIsSaving(false)
      return
    }

    setIsSaving(false)

    if (isOnboarding) {
      router.replace(nextPath)
      return
    }

    router.refresh()
  }

  return (
    <div className="space-y-4">
      {isOnboarding ? (
        <Card className="border-slate-300/75 bg-white/90">
          <CardHeader>
            <CardTitle className="font-display text-3xl leading-tight">
              Step {stepIndex + 1} of {onboardingSteps.length}
            </CardTitle>
            <CardDescription>{onboardingSteps[stepIndex].description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[var(--brand)] transition-[width]"
                style={{width: `${((stepIndex + 1) / onboardingSteps.length) * 100}%`}}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {(!isOnboarding || stepIndex === 0) ? (
        <Card className="border-slate-300/75 bg-white/90">
          <CardHeader>
            <CardTitle className="text-base">Mission interests</CardTitle>
            <CardDescription>Weighted highest in personalization.</CardDescription>
          </CardHeader>
          <CardContent>
            <InterestChips
              values={options.missionTags}
              selectedValues={interests.mission}
              onToggle={(value) => toggleInterest('mission', value)}
            />
          </CardContent>
        </Card>
      ) : null}

      {(!isOnboarding || stepIndex === 1) ? (
        <Card className="border-slate-300/75 bg-white/90">
          <CardHeader>
            <CardTitle className="text-base">Domain interests</CardTitle>
            <CardDescription>Weighted second in personalization.</CardDescription>
          </CardHeader>
          <CardContent>
            <InterestChips
              values={options.domains}
              selectedValues={interests.domain}
              onToggle={(value) => toggleInterest('domain', value)}
            />
          </CardContent>
        </Card>
      ) : null}

      {(!isOnboarding || stepIndex === 2) ? (
        <Card className="border-slate-300/75 bg-white/90">
          <CardHeader>
            <CardTitle className="text-base">Technology interests</CardTitle>
            <CardDescription>Weighted third in personalization.</CardDescription>
          </CardHeader>
          <CardContent>
            <InterestChips
              values={options.technologyTags}
              selectedValues={interests.tech}
              onToggle={(value) => toggleInterest('tech', value)}
            />
          </CardContent>
        </Card>
      ) : null}

      {(!isOnboarding || stepIndex === 3) ? (
        <Card className="border-slate-300/75 bg-white/90">
          <CardHeader>
            <CardTitle className="text-base">Confirm profile</CardTitle>
            <CardDescription>{totalSelections} interests selected.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">Mission</p>
              <div className="flex flex-wrap gap-2">
                {interests.mission.map((value) => (
                  <Badge key={`mission-${value}`} variant="secondary">
                    {value}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">Domain</p>
              <div className="flex flex-wrap gap-2">
                {interests.domain.map((value) => (
                  <Badge key={`domain-${value}`} variant="outline">
                    {value}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">Tech</p>
              <div className="flex flex-wrap gap-2">
                {interests.tech.map((value) => (
                  <Badge key={`tech-${value}`} variant="outline">
                    {value}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {isOnboarding ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-slate-300 bg-white"
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            disabled={stepIndex === 0 || isSaving}
          >
            Back
          </Button>
        ) : (
          <span className="text-muted-foreground text-sm">{totalSelections} interests selected</span>
        )}

        <div className="flex items-center gap-2">
          {isOnboarding && stepIndex < onboardingSteps.length - 1 ? (
            <Button
              type="button"
              className="rounded-full"
              onClick={() => setStepIndex((current) => Math.min(onboardingSteps.length - 1, current + 1))}
              disabled={!canAdvance || isSaving}
            >
              Continue
            </Button>
          ) : (
            <Button type="button" className="rounded-full" onClick={saveInterests} disabled={isSaving || totalSelections === 0}>
              {isSaving ? 'Saving...' : isOnboarding ? 'Save and continue' : 'Save interests'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
