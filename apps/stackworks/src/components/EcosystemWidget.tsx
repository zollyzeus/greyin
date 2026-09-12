import { Globe, CheckCircle2, Building2, BookOpen, Users, Briefcase, FlaskConical, Telescope } from 'lucide-react'

// Streamlined palette (audit finding: cross-app colors clashed --
// FlexPro's blue-purple gradient sat too close to Greyin's own
// indigo). One solid hue per pillar now, spread for distinction, with
// Greyin's indigo as the hub identity. Same six hex values are reused
// verbatim in each app's own hero/nav accent and in deepedge's
// capillary homepage section -- this object is the canonical source.
export const PILLARS = [
  { key: 'deepedge', label: 'DeepEdge', description: 'Enterprise hiring platform', url: 'https://deepedge.greyin.net', color: '#4F46E5' },
  { key: 'greymatters', label: 'GreyMatters', description: 'Technical blog', url: 'https://greymatters.greyin.net', color: '#0284C7' },
  { key: 'saltnpepper', label: 'Salt & Pepper', description: 'Senior peer community', url: 'https://saltnpepper.greyin.net', color: '#9333EA' },
  { key: 'flexpro', label: 'FlexPro', description: 'Freelance marketplace for verified experts', url: 'https://flexpro.greyin.net', color: '#EA580C' },
  { key: 'stackworks', label: 'StackWorks', description: 'Build with senior peers, earn a verified record', url: 'https://stackworks.greyin.net', color: '#0D9488' },
  { key: 'longlist', label: 'Longlist', description: 'Future roles, quietly explored', url: 'https://longlist.greyin.net', color: '#A16207' },
]

// Same brand-icon-per-pillar mapping SiteHeader's "More Platforms"
// dropdown already uses, for a real visual mark instead of a plain
// color dot -- exported here so WorkspaceShell's rail can share it too,
// since both already import PILLARS from this file. Kept in sync by
// hand across each of these mapping copies (SiteHeader/SiteFooter have
// their own), matching this platform's established per-app/per-file
// duplication convention rather than a new shared package for six icons.
export const PILLAR_ICONS: Record<string, typeof Building2> = {
  deepedge: Building2,
  greymatters: BookOpen,
  saltnpepper: Users,
  flexpro: Briefcase,
  stackworks: FlaskConical,
  longlist: Telescope,
}

/**
 * One login now works across all six *.greyin.net apps (shared cookie
 * domain) — this just makes that visible, since otherwise there's no way
 * for someone to discover the other pillars exist.
 */
export function EcosystemWidget({ activePillars }: { activePillars: string[] }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6 dark:bg-gray-900">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <Globe className="w-5 h-5" />
        Your Greyin Ecosystem
      </h2>
      <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
        One login works across all six Greyin apps — no separate signup needed.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {PILLARS.map((p) => {
          const isActive = activePillars.includes(p.key)
          const Icon = PILLAR_ICONS[p.key]
          return (
            <a
              key={p.key}
              href={p.url}
              className="flex flex-col items-center text-center gap-1.5 p-3 rounded-lg border text-sm border-gray-200 hover:border-gray-300 transition-colors dark:border-gray-800 dark:hover:border-gray-700"
              style={isActive ? { borderColor: p.color, backgroundColor: `${p.color}0d` } : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" style={{ color: p.color }} aria-hidden="true" />
              <p className="font-medium text-gray-900 flex items-center gap-1 dark:text-gray-50">
                {p.label}
                {isActive && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: p.color }} />}
              </p>
              <p className={`text-xs font-medium ${isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>{isActive ? 'Active' : 'Visit to join'}</p>
            </a>
          )
        })}
      </div>
    </div>
  )
}
