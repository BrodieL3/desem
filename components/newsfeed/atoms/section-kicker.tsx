import {cn} from '@/lib/utils'

type SectionKickerProps = {
  label: string
  className?: string
}

export function SectionKicker({label, className}: SectionKickerProps) {
  return (
    <p className={cn('text-muted-foreground inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] uppercase', className)}>
      <span className="bg-[var(--brand)] h-px w-5" />
      {label}
    </p>
  )
}
