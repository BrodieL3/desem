import {readFile} from 'node:fs/promises'

import type {SupabaseClient} from '@supabase/supabase-js'

import type {DefenseMoneyMacroContext} from './types'

type MacroEntryRow = {
  effective_week_start: string
  headline: string
  summary: string
  so_what: string
  source_label: string
  source_url: string
  tags: string[]
  is_active: boolean
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function stripQuotes(value: string) {
  const trimmed = compact(value)

  if (!trimmed) {
    return ''
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

function parseInlineTagList(value: string) {
  const trimmed = compact(value)

  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return []
  }

  return trimmed
    .slice(1, -1)
    .split(',')
    .map((entry) => stripQuotes(entry))
    .filter(Boolean)
}

function parseMacroYaml(contents: string): DefenseMoneyMacroContext[] {
  const lines = contents.split(/\r?\n/)

  const rows: Array<Record<string, string | string[]>> = []
  let current: Record<string, string | string[]> | null = null
  let readingTags = false

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '  ')

    if (!compact(line) || compact(line).startsWith('#')) {
      continue
    }

    const listItemMatch = line.match(/^\s*-\s*(.*)$/)

    if (listItemMatch) {
      const rest = compact(listItemMatch[1])

      if (rest.includes(':')) {
        const [key, ...valueParts] = rest.split(':')
        current = {
          [compact(key)]: stripQuotes(valueParts.join(':')),
        }
      } else {
        if (!current || !readingTags) {
          continue
        }

        const tags = Array.isArray(current.tags) ? current.tags : []
        tags.push(stripQuotes(rest))
        current.tags = tags
        continue
      }

      readingTags = false
      rows.push(current)
      continue
    }

    if (!current) {
      continue
    }

    const keyValue = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/)

    if (!keyValue) {
      continue
    }

    const key = compact(keyValue[1])
    const value = keyValue[2] ?? ''

    if (key === 'tags') {
      const inline = parseInlineTagList(value)
      current.tags = inline
      readingTags = inline.length === 0
      continue
    }

    current[key] = stripQuotes(value)
    readingTags = false
  }

  return rows
    .map((row): DefenseMoneyMacroContext | null => {
      const effectiveWeekStart = compact(String(row.effectiveWeekStart ?? row.effective_week_start ?? ''))
      const headline = compact(String(row.headline ?? ''))
      const summary = compact(String(row.summary ?? ''))
      const soWhat = compact(String(row.soWhat ?? row.so_what ?? ''))
      const sourceLabel = compact(String(row.sourceLabel ?? row.source_label ?? ''))
      const sourceUrl = compact(String(row.sourceUrl ?? row.source_url ?? ''))
      const tags = Array.isArray(row.tags) ? row.tags.map((entry) => compact(String(entry))).filter(Boolean) : []

      if (!effectiveWeekStart || !headline || !summary || !soWhat || !sourceLabel || !sourceUrl) {
        return null
      }

      return {
        effectiveWeekStart,
        headline,
        summary,
        soWhat,
        sourceLabel,
        sourceUrl,
        tags,
        isActive: true,
      }
    })
    .filter((row): row is DefenseMoneyMacroContext => row !== null)
    .sort((left, right) => Date.parse(left.effectiveWeekStart) - Date.parse(right.effectiveWeekStart))
}

export async function loadMacroContextFromYaml(path: string) {
  const contents = await readFile(path, 'utf8')
  return parseMacroYaml(contents)
}

export function resolveActiveMacroContext(entries: DefenseMoneyMacroContext[], targetDate: string) {
  if (entries.length === 0) {
    return null
  }

  const targetTimestamp = Date.parse(targetDate)

  const valid = entries
    .filter((entry) => Number.isFinite(Date.parse(entry.effectiveWeekStart)))
    .filter((entry) => Date.parse(entry.effectiveWeekStart) <= targetTimestamp)

  if (valid.length > 0) {
    return valid.sort((left, right) => Date.parse(right.effectiveWeekStart) - Date.parse(left.effectiveWeekStart))[0] ?? null
  }

  return entries[entries.length - 1] ?? null
}

export async function upsertMacroContextEntries(supabase: SupabaseClient, entries: DefenseMoneyMacroContext[]) {
  if (entries.length === 0) {
    return 0
  }

  const rows: MacroEntryRow[] = entries.map((entry) => ({
    effective_week_start: entry.effectiveWeekStart,
    headline: entry.headline,
    summary: entry.summary,
    so_what: entry.soWhat,
    source_label: entry.sourceLabel,
    source_url: entry.sourceUrl,
    tags: entry.tags,
    is_active: entry.isActive,
  }))

  const {error} = await supabase.from('defense_money_macro_context').upsert(rows, {
    onConflict: 'effective_week_start',
  })

  if (error) {
    throw new Error(`Unable to upsert macro context rows: ${error.message}`)
  }

  return rows.length
}
