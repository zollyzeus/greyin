import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { AdminTabNav } from '@/components/admin/AdminTabNav'

// The auth+role check every /admin/* page used to repeat individually --
// now done once here. Each existing site-wide page (page.tsx, llm,
// threshold-votes, peer-projects, wishlist, feedback, bias-audit,
// job-recommendation-feedback, market-intelligence, cross-pillar-flags)
// keeps its own copy of this same check too (defense in depth, and it
// was already correct) -- what changed is each of those pages no longer
// renders its own <SiteHeader>/<main> wrapper, since this layout now
// provides that chrome once for the whole /admin/* tree instead of once
// per page (was a real double-header bug otherwise: this layout renders
// SiteHeader unconditionally, so a child page rendering its own on top
// would show it twice).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />
      <AdminTabNav />
      {children}
    </main>
  )
}
