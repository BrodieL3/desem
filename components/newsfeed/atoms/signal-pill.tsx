import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'

type SignalPillProps = {
  label: string
  tone?: 'default' | 'muted' | 'critical'
  className?: string
}

const toneClasses: Record<NonNullable<SignalPillProps['tone']>, string> = {
  default: 'border-slate-300 bg-white text-slate-800',
  muted: 'border-slate-200 bg-slate-100/80 text-slate-600',
  critical: 'border-rose-200 bg-rose-50 text-rose-700',
}

export function SignalPill({label, tone = 'default', className}: SignalPillProps) {
  return (
    <Badge
      variant="outline"
      className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.02em]', toneClasses[tone], className)}
    >
      {label}
    </Badge>
  )
}
