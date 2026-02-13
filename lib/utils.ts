import {clsx, type ClassValue} from 'clsx'
import {twMerge} from 'tailwind-merge'

const htmlEntityMap: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  ndash: '-',
  mdash: '-',
  hellip: '...',
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity: string, token: string) => {
    const normalized = token.toLowerCase()

    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16)
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint)
    }

    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10)
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint)
    }

    return htmlEntityMap[normalized] ?? entity
  })
}

export function sanitizeHeadlineText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .replace(/&(?:[a-z]{2,12}|#x?[0-9a-f]{2,8})$/i, '')
    .trim()
}

export function sanitizePlainText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .trim()
}
