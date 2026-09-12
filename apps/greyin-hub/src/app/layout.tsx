import { Newsreader, Inter } from 'next/font/google'
import './globals.css'
import { IdleSessionGuard } from '@/components/IdleSessionGuard'
import { SiteFooter } from '@/components/SiteFooter'

// Platform-wide typography system (2026-09-03) -- see apps/flexpro/src/app/layout.tsx's
// own comment for the full rationale.
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata = {
  title: 'Greyin - One account, six platforms for experienced professionals',
  description: 'The ecosystem hub for Greyin: enterprise hiring, technical writing, freelancing, peer community, building with senior peers, and future roles no one else can see yet -- one account, one Greyin Score, six platforms.',
  icons: { icon: '/logo.png' },
}

// Preview-deployment notice (2026-09-03) -- see apps/flexpro/src/app/layout.tsx's
// own comment for why this is duplicated per app rather than shared.
// Already a dark surface by design (bg-gray-900), so no theme-conditional
// classes needed -- it reads correctly against either page theme.
function PreviewBanner() {
  return (
    <div className="bg-gray-900 dark:bg-black text-gray-300 text-xs text-center py-1.5 px-4">
      <span className="font-medium text-white">Preview build</span> — people, companies, and activity shown across Greyin are seeded demonstration data, not real users.
    </div>
  )
}

// Applies the visitor's persisted (or OS-default) theme to <html> before
// first paint. Must be a plain synchronous inline script, not a
// component or useEffect -- anything that waits for React to hydrate
// runs after the browser has already painted the server-rendered
// (always light-mode-classed) HTML once, producing a visible flash from
// light to dark for anyone who'd chosen dark. See ThemeToggle.tsx for
// the click-driven toggle this hands off to after load.
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
