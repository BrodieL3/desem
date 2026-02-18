'use client'

import { useState } from 'react'

export function ExpandableStoryContent({
  dek,
  expandedDek,
}: {
  dek: string
  expandedDek: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-2">
      <p className="text-muted-foreground text-[1.03rem] leading-relaxed">
        {expanded ? expandedDek : dek}
      </p>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-primary mt-1 text-sm font-medium hover:underline"
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>
    </div>
  )
}
