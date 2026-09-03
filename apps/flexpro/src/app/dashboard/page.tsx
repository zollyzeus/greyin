import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Package, ShoppingCart, Settings, LogOut, Wallet, ShieldCheck, Bell, Rss } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false)

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <a href="https://greyin.net" className="flex items-center gap-2 text-xl font-bold text-indigo-600">
              <Package className="w-6 h-6" />
              <span>FlexPro</span>
            </a>
            <div className="flex items-center gap-4">
              <Link href="/feed" className="p-2" title="Feed">
                <Rss className="w-5 h-5" />
              </Link>
              <Link href="/notifications" className="relative p-2" title="Notifications">
                <Bell className="w-5 h-5" />
                {!!unreadCount && (
                  <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/profile" className="p-2" title="Profile">
                <Settings className="w-5 h-5" />
              </Link>
              <form action="/auth/logout" method="POST">
                <button className="flex items-center gap-2 px-4 py-2">
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-1">Welcome, {profile?.full_name || 'Seller'}!</h1>
        <p className="text-sm text-gray-600 mb-4">
          {(activeGigCount ?? 0) > 0
            ? `You have ${activeGigCount} active gig${activeGigCount === 1 ? '' : 's'} listed`
            : "You haven't listed a gig yet"}
          {(pendingOrderCount ?? 0) > 0 && `, and ${pendingOrderCount} order${pendingOrderCount === 1 ? '' : 's'} in progress`}.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/gigs" className="p-6 bg-white rounded-lg shadow hover:shadow-lg">
            <Package className="w-8 h-8 text-indigo-600 mb-2" />
            <h2 className="text-xl font-semibold">My Gigs</h2>
            <p className="text-gray-600">View and manage your services</p>
          </Link>
          <Link href="/orders" className="p-6 bg-white rounded-lg shadow hover:shadow-lg">
            <ShoppingCart className="w-8 h-8 text-indigo-600 mb-2" />
            <h2 className="text-xl font-semibold">Orders</h2>
            <p className="text-gray-600">Track your orders and earnings</p>
          </Link>
          {profile?.role === 'freelancer' && (
            <Link href="/earnings" className="p-6 bg-white rounded-lg shadow hover:shadow-lg">
              <Wallet className="w-8 h-8 text-indigo-600 mb-2" />
              <h2 className="text-xl font-semibold">Earnings</h2>
              <p className="text-gray-600">View your balance and request a withdrawal</p>
            </Link>
          )}
          {profile?.role === 'admin' && (
            <Link href="/admin" className="p-6 bg-white rounded-lg shadow hover:shadow-lg">
              <ShieldCheck className="w-8 h-8 text-red-600 mb-2" />
              <h2 className="text-xl font-semibold">Admin</h2>
              <p className="text-gray-600">Moderate listings and process withdrawals</p>
            </Link>
          )}
        </div>

        {myGigs && myGigs.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">My recent activity</h2>
            <div className="divide-y">
              {myGigs.map((g) => (
                <div key={g.id} className="py-3 flex items-center justify-between gap-4">
                  <Link href={`/gigs/${g.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                    {g.title}
                  </Link>
                  <form action={`/api/gigs/${g.id}/feed-visibility`} method="POST" className="flex items-center gap-2">
                    <select
                      name="feed_visibility"
                      defaultValue={g.feed_visibility}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1"
                    >
                      <option value="public">Public</option>
                      <option value="followers">Followers only</option>
                      <option value="private">Don&rsquo;t include</option>
                    </select>
                    <button type="submit" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                      Save
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
