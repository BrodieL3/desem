import type {ReactNode} from 'react'

import {cn} from '@/lib/utils'

type SectionLabelProps = {
  id?: string
  children: ReactNode
  className?: string
  withRule?: boolean
}

export function SectionLabel({id, children, className, withRule = false}: SectionLabelProps) {
  return (
    <h2
      id={id}
      className={cn(
        'text-xs tracking-[0.16em] uppercase text-muted-foreground',
        withRule ? 'border-t border-border pt-4' : null,
        className
      )}
    >
      {children}
    </h2>
  )
}
