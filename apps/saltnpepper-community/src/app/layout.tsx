import { Newsreader, Inter } from 'next/font/google'
import './globals.css'
import { IdleSessionGuard } from '@/components/IdleSessionGuard'
import { SiteFooter } from '@/components/SiteFooter'

// Platform-wide typography system (2026-09-03) -- see apps/flexpro/src/app/layout.tsx's
// own comment for the full rationale.
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata = {
  title: 'Salt & Pepper - Community Forum',
  description: 'Professional community and discussions',
}

// Preview-deployment notice (2026-09-03) -- see apps/flexpro/src/app/layout.tsx's
// own comment for why this is duplicated per app rather than shared.
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
