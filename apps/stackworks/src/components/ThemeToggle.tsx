'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

// Light/dark mode toggle (2026-09-04) -- foundation pass, built here first
// as the reference implementation before being replicated to the other 6
// apps (per-app duplication, not a shared package, matching this
// platform's established convention -- see IdleSessionGuard.tsx's own
// comment). Persisted in localStorage: each subdomain is a separate
// origin, so unlike the SSO session cookie a theme choice does not follow
// a visitor across pillars automatically -- acceptable, since it's a
// display preference, not identity or data.
//
// The actual .dark class toggle on <html> happens here for user clicks,
// but the *initial* state on every page load is set synchronously by an
// inline <script> in layout.tsx's own <head>, before hydration -- doing
// it only here would flash light-mode HTML first on every reload for
// anyone who'd chosen dark.
export const THEME_STORAGE_KEY = 'greyin:theme'

export function ThemeToggle() {
  // null until the client-only check below resolves -- rendering a fixed
  // placeholder instead of guessing avoids a wrong-icon flash and a
  // header layout shift on hydration.
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
