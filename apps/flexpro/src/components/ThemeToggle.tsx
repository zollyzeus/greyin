'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

// Light/dark mode toggle (2026-09-04) -- see apps/greyin-hub/src/components/
// ThemeToggle.tsx's own comment for the full rationale; duplicated here
// rather than shared per this platform's established per-app-component
// convention. The initial .dark class on <html> is set synchronously by
// an inline <script> in layout.tsx's own <head>, before hydration --
// this component only toggles it after that, on click.
export const THEME_STORAGE_KEY = 'greyin:theme'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light')
    } catch {
      // Private-mode/storage-blocked browsers -- toggle still works for
      // this page view, it just won't be remembered next visit.
    }
    setIsDark(next)
  }

  if (isDark === null) {
    return <span className="inline-block w-9 h-9" aria-hidden="true" />
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white transition"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
