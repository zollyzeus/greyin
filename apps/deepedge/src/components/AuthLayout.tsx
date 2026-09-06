import { Building2 } from 'lucide-react'

/**
 * UI/UX elevation plan, Phase 3 -- "middle option" revision (2026-09-06).
 * The split-screen brand panel (previous version) left a large empty
 * plain on wide monitors with the form lost in it. Reverted to a
 * centered card -- the conventional, viewport-robust auth pattern -- but
 * kept the per-pillar accent (icon + wordmark + a soft pillar-tinted
 * background wash) so it still reads as DeepEdge, not a generic form.
 * Same props as before, so the 5 auth pages consuming it are unchanged.
 */
export function AuthLayout({
  title,
  subtitle,
  wide,
  children,
}: {
  title: React.ReactNode
  subtitle: React.ReactNode
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <div className={wide ? 'max-w-2xl w-full' : 'max-w-md w-full'}>
        <div className="text-center mb-8">
          <a
            href="https://greyin.net"
            className="inline-flex items-center gap-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400"
          >
            <Building2 className="w-7 h-7" />
            <span>DeepEdge</span>
          </a>
          <h2 className="font-display mt-5 text-2xl font-semibold text-gray-900 dark:text-gray-50">{title}</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
