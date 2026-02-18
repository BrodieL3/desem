'use client'

import {ChevronLeft} from 'lucide-react'
import Link from 'next/link'
import {useState} from 'react'

import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'

type BackToFrontPageButtonProps = {
  className?: string
}

export function BackToFrontPageButton({className}: BackToFrontPageButtonProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={cn(
        'fixed top-3 left-3 z-50 flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-1 py-1 shadow-sm backdrop-blur-sm transition-all duration-200 supports-[backdrop-filter]:bg-background/65 md:top-5 md:left-5',
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Back to Home">
        <Link href="/">
          <ChevronLeft className="size-5" />
        </Link>
      </Button>
      {hovered ? (
        <Link
          href="/"
          className="pr-3 text-sm font-medium whitespace-nowrap text-foreground"
        >
          Back to Home
        </Link>
      ) : null}
    </div>
  )
}
