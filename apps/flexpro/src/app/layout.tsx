import { Newsreader, Inter } from 'next/font/google'
import './globals.css'
import { IdleSessionGuard } from '@/components/IdleSessionGuard'
import { SiteFooter } from '@/components/SiteFooter'

// Platform-wide typography system (2026-09-03 design pass): every app was
// either running zero font customization (falling back to the browser's
// generic sans-serif) or, in GreyMatters/DeepEdge's case, Inter alone with
// no display treatment -- flagged by the Emergent comparison as the
// platform's single highest-leverage visual gap ("6 apps don't read as one
// platform"). Newsreader (a considered text serif, not a trendy display
// face) carries headlines/hero copy platform-wide via --font-display;
// Inter stays the body/UI face everywhere, now applied consistently
// instead of accidentally defaulting per app. Each app keeps its own
// PILLARS accent color -- a shared type system, not a shared palette, is
// what makes six distinct products read as one considered platform rather
// than sanding off each pillar's own identity.
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata = {
  title: 'FlexPro - Freelance Marketplace',
  description: 'Find and hire talented freelancers',
}

// Preview-deployment notice (2026-09-03): identical wording/placement in
// every app's own layout.tsx (not a shared import -- matches this
// platform's established per-app-duplication convention for small,
// identical components) so it renders on every route, auth screens
// included, regardless of whether that page uses SiteHeader.
//
// Fixed height (lg:h-8, 2026-09-12): WorkspaceShell's rail is
// `lg:fixed lg:inset-y-0` -- position:fixed takes it out of normal
// document flow entirely, so at the `lg` breakpoint it used to start at
// the very top of the viewport (y=0), painting over this banner's left
// 256px (the rail's width) instead of sitting below it like the rest of
// the page does. That also meant the rail's own top brand row and the
// content column's header row -- both h-16 -- started at different y
// offsets (0 vs. this banner's height), so their bottom borders never
// lined up either. Giving this banner a fixed, known height at `lg` and
// pointing the rail at that same offset (`lg:top-8` instead of
// `lg:inset-y-0`, see WorkspaceShell.tsx) fixes both: the banner now
// spans the full width including behind where the rail begins, and the
// two h-16 rows start from the same y and stay in sync.
//
// dark:bg-black (2026-09-13): the rail/header both use bg-gray-900 in
// dark mode -- this banner used the exact same gray-900 unconditionally,
// so in dark mode it visually blended into the sidebar right below it
// with no visible seam. Pure black is a deliberately different shade
// from gray-900 (not just a slightly darker gray, which could still
// read as "the same panel") so the banner reads as its own strip in
// both themes, not an extension of the sidebar/header.
function PreviewBanner() {
  return (
    <div className="bg-gray-900 dark:bg-black text-gray-300 text-xs text-center py-1.5 px-4 lg:h-8 lg:flex lg:items-center lg:justify-center lg:py-0">
      <span className="font-medium text-white">Preview build</span> — people, companies, and activity shown across Greyin are seeded demonstration data, not real users.
    </div>
  )
}

// Light/dark mode (2026-09-04) -- see apps/greyin-hub/src/app/layout.tsx's
// own comment for the full rationale. Applies the persisted (or
// OS-default) theme to <html> before first paint, synchronously, so
// there's no flash from light to dark for a visitor who'd chosen dark.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('greyin:theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <PreviewBanner />
        {children}
        <SiteFooter />
        <IdleSessionGuard />
      </body>
    </html>
  )
}
