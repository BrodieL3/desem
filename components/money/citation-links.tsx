import Link from 'next/link'

import type {DefenseMoneyCitation} from '@/lib/data/signals/types'

type CitationLinksProps = {
  citations: DefenseMoneyCitation[]
  max?: number
}

export function CitationLinks({citations, max = 3}: CitationLinksProps) {
  if (citations.length === 0) {
    return null
  }

  return (
    <div className="mt-2 space-y-1 text-xs">
      {citations.slice(0, max).map((citation) => (
        <p key={citation.id}>
          <Link
            href={citation.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
          >
            {citation.label}
          </Link>
        </p>
      ))}
    </div>
  )
}
