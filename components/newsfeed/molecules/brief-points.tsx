type BriefPointsProps = {
  points: string[]
  maxItems?: number
}

export function BriefPoints({points, maxItems = 3}: BriefPointsProps) {
  const visible = points.slice(0, maxItems)

  return (
    <ul className="space-y-2.5">
      {visible.map((point) => (
        <li key={point} className="grid grid-cols-[10px_minmax(0,1fr)] gap-2 text-sm leading-relaxed">
          <span className="bg-[var(--brand)] mt-2 h-1.5 w-1.5 rounded-full" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  )
}
