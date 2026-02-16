import type {DefenseMoneyBucket} from './types'

export type DefenseMoneyChartColorToken = `chart-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`

export const defenseMoneyBucketColorMap: Record<DefenseMoneyBucket, DefenseMoneyChartColorToken> = {
  ai_ml: 'chart-1',
  c5isr: 'chart-2',
  space: 'chart-3',
  autonomy: 'chart-4',
  cyber: 'chart-5',
  munitions: 'chart-6',
  ew: 'chart-7',
  counter_uas: 'chart-8',
}

export const defenseMoneyBucketLabelMap: Record<DefenseMoneyBucket, string> = {
  ai_ml: 'AI/ML',
  c5isr: 'C5ISR',
  space: 'Space',
  autonomy: 'Autonomy',
  cyber: 'Cyber',
  munitions: 'Munitions',
  ew: 'EW',
  counter_uas: 'Counter-UAS',
}

export function formatDefenseMoneyBucketLabel(bucket: DefenseMoneyBucket) {
  return defenseMoneyBucketLabelMap[bucket]
}
