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
function PreviewBanner() {
  return (
    <div className="bg-gray-900 text-gray-300 text-xs text-center py-1.5 px-4">
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
