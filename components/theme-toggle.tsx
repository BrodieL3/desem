'use client'

import {Moon, Sun} from 'lucide-react'
import {useEffect, useState} from 'react'

import {Button} from '@/components/ui/button'

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

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const isDark = theme === 'dark'

  return (
    <div className="fixed top-3 right-3 z-50 md:top-5 md:right-5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full border-slate-300 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
      >
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        <span className="ml-2 text-xs">{isDark ? 'Light' : 'Dark'}</span>
      </Button>
    </div>
  )
}
