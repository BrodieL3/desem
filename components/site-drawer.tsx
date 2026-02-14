'use client'

import Link from 'next/link'
import {LogIn, LogOut, UserRound} from 'lucide-react'

import {ThemeToggle} from '@/components/theme-toggle'
import {Button} from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Separator} from '@/components/ui/separator'

type SiteDrawerProps = {
  isAuthenticated: boolean
  email?: string | null
}

export function SiteDrawer({isAuthenticated, email}: SiteDrawerProps) {
  const authHref = isAuthenticated ? '/auth/sign-out' : '/auth/sign-in?next=/'

  return (
    <div className="pointer-events-none fixed top-3 right-3 z-50 md:top-5 md:right-5">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-background/75 px-2 py-1.5 shadow-sm backdrop-blur transition-opacity supports-[backdrop-filter]:bg-background/70 hover:opacity-100 focus-within:opacity-100 opacity-65">
        <ThemeToggle showLabel={false} className="rounded-full" />
        <Separator orientation="vertical" className="h-6" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label="Account options">
              <UserRound className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="truncate">{isAuthenticated ? email ?? 'Signed in' : 'Account'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={authHref}>
                {isAuthenticated ? <LogOut className="size-4" /> : <LogIn className="size-4" />}
                {isAuthenticated ? 'Sign out' : 'Sign in'}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/">Front page</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
