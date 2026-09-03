import type { Metadata } from 'next'
import { Newsreader, Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { IdleSessionGuard } from '@/components/IdleSessionGuard'
import { SiteFooter } from '@/components/SiteFooter'

// Platform-wide typography system (2026-09-03) -- see apps/flexpro/src/app/layout.tsx's
// own comment for the full rationale.
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'DeepEdge - B2B Recruitment Platform',
  description: 'Connect companies with top talent. Post jobs, find candidates, and build your team.',
  keywords: ['recruitment', 'jobs', 'hiring', 'B2B', 'talent acquisition'],
}

// Preview-deployment notice (2026-09-03) -- see apps/flexpro/src/app/layout.tsx's
// own comment for why this is duplicated per app rather than shared.
function PreviewBanner() {
  return (
    <div className="bg-gray-900 text-gray-300 text-xs text-center py-1.5 px-4">
      <span className="font-medium text-white">Preview build</span> — people, companies, and activity shown across Greyin are seeded demonstration data, not real users.
    </div>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${newsreader.variable} ${inter.variable}`}>
      <body className={inter.className}>
        <PreviewBanner />
        {children}
        <SiteFooter />
        <IdleSessionGuard />
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
