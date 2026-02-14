'use client'

import {Moon, Sun} from 'lucide-react'
import {useEffect, useState} from 'react'

import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'

type Theme = 'light' | 'dark'

const THEME_KEY = 'theme'

function applyTheme(theme: Theme) {
  const isDark = theme === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.style.colorScheme = theme
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

type ThemeToggleProps = {
  className?: string
  showLabel?: boolean
}

export function ThemeToggle({className, showLabel = true}: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const isDark = theme === 'dark'

  return (
    <Button
      type="button"
      variant={showLabel ? 'secondary' : 'ghost'}
      size="sm"
      className={cn(showLabel ? 'justify-start' : 'justify-center', className)}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {showLabel ? <span>{isDark ? 'Light mode' : 'Dark mode'}</span> : null}
    </Button>
  )
}
