import type {ReactNode} from 'react'

import type {DataModuleHeader} from './types'

type ModuleShellProps = {
  header: DataModuleHeader
  actions?: ReactNode
  children: ReactNode
  className?: string
}

function compact(value: string | null | undefined) {
  return value?.trim() ?? ''
}

export function ModuleShell({header, actions, children, className}: ModuleShellProps) {
  const hasDescription = compact(header.description).length > 0

  return (
    <section className={className}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          {compact(header.eyebrow) ? (
            <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase">{header.eyebrow}</p>
          ) : null}
          <h2 className="font-display text-[2rem] leading-tight md:text-[2.25rem]">{header.title}</h2>
          {hasDescription ? <p className="text-muted-foreground text-base">{header.description}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}
