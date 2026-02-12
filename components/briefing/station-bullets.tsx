'use client'

import {useMemo} from 'react'

import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from '@/components/ui/accordion'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {stationLabels, stationValues} from '@/lib/defense/constants'
import type {AnalystViewItem} from '@/lib/defense/types'

type StationBulletsProps = {
  analystView: AnalystViewItem[]
  launchLimit?: number
}

function dedupeBullets(analystView: AnalystViewItem[]) {
  const deduped: string[] = []
  const seen = new Set<string>()

  for (const entry of analystView) {
    for (const bullet of entry.bullets) {
      const normalized = bullet.trim()
      const key = normalized.toLowerCase()

      if (!normalized || seen.has(key)) {
        continue
      }

      seen.add(key)
      deduped.push(normalized)
    }
  }

  return deduped
}

function bulletsForStation(analystView: AnalystViewItem[], station: AnalystViewItem['station']) {
  return analystView.find((entry) => entry.station === station)?.bullets ?? []
}

export function StationBullets({analystView, launchLimit = 4}: StationBulletsProps) {
  const visibleStations = useMemo(
    () => stationValues.filter((station) => analystView.some((entry) => entry.station === station)),
    [analystView]
  )

  const blendedBullets = useMemo(() => dedupeBullets(analystView).slice(0, launchLimit), [analystView, launchLimit])

  if (blendedBullets.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">Blended summary</p>
        <ul className="space-y-2">
          {blendedBullets.map((bullet) => (
            <li key={bullet} className="bg-muted rounded-md p-3 text-sm leading-relaxed">
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      {visibleStations.length > 1 ? (
        <Accordion type="single" collapsible>
          <AccordionItem value="stations">
            <AccordionTrigger>Drill down by station</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1">
              <Tabs defaultValue={visibleStations[0]}>
                <TabsList>
                  {visibleStations.map((station) => (
                    <TabsTrigger key={station} value={station}>
                      {stationLabels[station]}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {visibleStations.map((station) => (
                  <TabsContent key={station} value={station}>
                    <ul className="space-y-2">
                      {bulletsForStation(analystView, station).map((bullet) => (
                        <li key={`${station}:${bullet}`} className="bg-muted rounded-md p-3 text-sm leading-relaxed">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </TabsContent>
                ))}
              </Tabs>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  )
}
