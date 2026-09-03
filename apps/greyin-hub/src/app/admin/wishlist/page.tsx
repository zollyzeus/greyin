import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { ArrowLeft, Lightbulb, Download } from 'lucide-react'

const STATUSES = ['open', 'planned', 'shipped', 'declined']

export default async function AdminWishlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/wishlist')
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: requests } = await supabase
    .from('feature_requests')
    .select('id, title, description, status, upvote_count, created_at, profiles:user_id ( full_name, email )')
    .order('upvote_count', { ascending: false })
    .limit(200)

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to admin
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Feature Wishlist</h1>
          </div>
          <a
            href="/api/admin/wishlist/export"
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-600 border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          {requests && requests.length > 0 ? (
            <div className="divide-y">
              {requests.map((r: any) => (
                <div key={r.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-gray-900">{r.title} <span className="text-xs text-gray-400 font-normal">({r.upvote_count} upvotes)</span></p>
                    <p className="text-xs text-gray-500">{r.profiles?.full_name || r.profiles?.email}</p>
                  </div>
                  <form action="/api/admin/wishlist/update-status" method="POST" className="flex items-center gap-2">
                    <input type="hidden" name="feature_request_id" value={r.id} />
                    <select name="status" defaultValue={r.status} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 capitalize">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button type="submit" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Save</button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No suggestions yet.</p>
          )}
        </div>
      </div>
    </main>
  )
}
