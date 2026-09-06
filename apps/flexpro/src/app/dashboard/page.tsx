import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Package, ShoppingCart, Wallet, ShieldCheck } from 'lucide-react'
import { EcosystemWidget } from '@/components/EcosystemWidget'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const { data: scoreRow } = await supabase
    .from('greyin_scores')
    .select('greyin_score, is_verified_expert')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: memberships } = await supabase
    .from('pillar_memberships')
    .select('pillar')
    .eq('user_id', user.id)

  const { data: myGigs } = await supabase
    .from('gigs')
    .select('id, title, created_at, feed_visibility')
    .eq('freelancer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Gap-audit item #10 -- personalized activity line, same pattern as
  // Longlist's dashboard (count-only queries, plain-English sentence).
  const [{ count: activeGigCount }, { count: pendingOrderCount }] = await Promise.all([
    supabase.from('gigs').select('id', { count: 'exact', head: true }).eq('freelancer_id', user.id).eq('status', 'active'),
    supabase.from('gig_orders').select('id', { count: 'exact', head: true }).eq('seller_id', user.id).in('status', ['paid', 'authorized', 'in_progress', 'delivered', 'revision_requested']),
  ])

  return (
    <WorkspaceShell
      activeSection="dashboard"
      role={profile?.role}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Dashboard"
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-1">Welcome, {profile?.full_name || 'Seller'}!</h1>
        <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
          {(activeGigCount ?? 0) > 0
            ? `You have ${activeGigCount} active gig${activeGigCount === 1 ? '' : 's'} listed`
            : "You haven't listed a gig yet"}
          {(pendingOrderCount ?? 0) > 0 && `, and ${pendingOrderCount} order${pendingOrderCount === 1 ? '' : 's'} in progress`}.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/gigs" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
            <Package className="w-8 h-8 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="text-xl font-semibold">My Gigs</h2>
            <p className="text-gray-600 dark:text-gray-400">View and manage your services</p>
          </Link>
          <Link href="/orders" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
            <ShoppingCart className="w-8 h-8 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="text-xl font-semibold">Orders</h2>
            <p className="text-gray-600 dark:text-gray-400">Track your orders and earnings</p>
          </Link>
          {profile?.role === 'freelancer' && (
            <Link href="/earnings" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
              <Wallet className="w-8 h-8 text-indigo-600 mb-2 dark:text-indigo-400" />
              <h2 className="text-xl font-semibold">Earnings</h2>
              <p className="text-gray-600 dark:text-gray-400">View your balance and request a withdrawal</p>
            </Link>
          )}
          {profile?.role === 'admin' && (
            <Link href="/admin" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
              <ShieldCheck className="w-8 h-8 text-red-600 mb-2 dark:text-red-400" />
              <h2 className="text-xl font-semibold">Admin</h2>
              <p className="text-gray-600 dark:text-gray-400">Moderate listings and process withdrawals</p>
            </Link>
          )}
        </div>

        {myGigs && myGigs.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold mb-4">My recent activity</h2>
            <div className="divide-y">
              {myGigs.map((g) => (
                <div key={g.id} className="py-3 flex items-center justify-between gap-4">
                  <Link href={`/gigs/${g.id}`} className="font-medium text-gray-900 hover:text-indigo-600 dark:text-gray-50">
                    {g.title}
                  </Link>
                  <form action={`/api/gigs/${g.id}/feed-visibility`} method="POST" className="flex items-center gap-2">
                    <select
                      name="feed_visibility"
                      defaultValue={g.feed_visibility}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    >
                      <option value="public">Public</option>
                      <option value="followers">Followers only</option>
                      <option value="private">Don&rsquo;t include</option>
                    </select>
                    <button type="submit" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                      Save
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8">
          <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />
        </div>
      </div>
    </WorkspaceShell>
  )
}
