import { Globe, CheckCircle2 } from 'lucide-react'

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

/**
 * One login now works across all six *.greyin.net apps (shared cookie
 * domain) — this just makes that visible, since otherwise there's no way
 * for someone to discover the other pillars exist.
 */
export function EcosystemWidget({ activePillars }: { activePillars: string[] }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <Globe className="w-5 h-5" />
        Your Greyin Ecosystem
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        One login works across all six Greyin apps — no separate signup needed.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PILLARS.map((p) => {
          const isActive = activePillars.includes(p.key)
          return (
            <a
              key={p.key}
              href={p.url}
              className="flex items-start gap-3 p-3 rounded-lg border text-sm border-gray-200 hover:border-gray-300 transition-colors"
              style={isActive ? { borderColor: p.color, backgroundColor: `${p.color}0d` } : undefined}
            >
              <span className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />
              <div>
                <p className="font-medium text-gray-900 flex items-center gap-1.5">
                  {p.label}
                  {isActive && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: p.color }} />}
                </p>
                <p className="text-xs text-gray-500">{isActive ? 'Active' : p.description + ' — visit to join'}</p>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
