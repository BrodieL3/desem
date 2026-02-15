import {ChevronLeft} from 'lucide-react'
import Link from 'next/link'

import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'

type BackToFrontPageButtonProps = {
  className?: string
}

export function BackToFrontPageButton({className}: BackToFrontPageButtonProps) {
  return (
    <div
      className={cn(
        'fixed top-3 left-3 z-50 flex items-center justify-center rounded-full border border-border/80 bg-background/80 p-1 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/65 md:top-5 md:left-5',
        className
      )}
    >
      <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Back to front page">
        <Link href="/" title="Back to front page">
          <ChevronLeft className="size-5" />
        </Link>
      </Button>
    </div>
  )
}
