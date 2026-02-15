const ET_TIME_ZONE = 'America/New_York'

function formatDateInEt(input: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ET_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(input)
}

function parseIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

export function currentEtDate(input = new Date()) {
  const iso = formatDateInEt(input)
  return parseIsoDate(iso) ?? new Date()
}

export function priorBusinessDayEt(input = new Date()) {
  const etToday = currentEtDate(input)
  const cursor = new Date(etToday)

  cursor.setUTCDate(cursor.getUTCDate() - 1)

  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  return toIsoDate(cursor)
}

export function shiftIsoDate(value: string, deltaDays: number) {
  const parsed = parseIsoDate(value)

  if (!parsed) {
    return value
  }

  parsed.setUTCDate(parsed.getUTCDate() + deltaDays)
  return toIsoDate(parsed)
}

export function weekStartIso(value: string) {
  const parsed = parseIsoDate(value)

  if (!parsed) {
    return value
  }

  const weekday = parsed.getUTCDay()
  const dayShift = weekday === 0 ? 6 : weekday - 1
  parsed.setUTCDate(parsed.getUTCDate() - dayShift)
  return toIsoDate(parsed)
}

export function weekEndIso(value: string) {
  return shiftIsoDate(weekStartIso(value), 6)
}

export function monthStartIso(value: string) {
  const parsed = parseIsoDate(value)

  if (!parsed) {
    return value
  }

  parsed.setUTCDate(1)
  return toIsoDate(parsed)
}

export function monthEndIso(value: string) {
  const parsed = parseIsoDate(value)

  if (!parsed) {
    return value
  }

  parsed.setUTCMonth(parsed.getUTCMonth() + 1)
  parsed.setUTCDate(0)
  return toIsoDate(parsed)
}

export function isStaleDate(value: string | null | undefined, thresholdDays: number) {
  if (!value) {
    return true
  }

  const parsed = parseIsoDate(value)

  if (!parsed) {
    return true
  }

  const ageDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)
  return ageDays > thresholdDays
}

export function isoFromDate(value: Date) {
  return toIsoDate(value)
}
