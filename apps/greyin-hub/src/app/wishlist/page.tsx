import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { Lightbulb, ThumbsUp } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-gray-100 text-gray-700',
  planned: 'bg-blue-50 text-blue-700',
  shipped: 'bg-green-50 text-green-700',
  declined: 'bg-red-50 text-red-700',
}

// Gap-audit item #5: public feature wishlist with upvoting. Platform-wide,
// houses on Hub (no pillar affiliation of its own -- same precedent as
// the LLM-provider panel and test-data cleanup).
export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: requests } = await supabase
    .from('feature_requests')
    .select('id, title, description, status, upvote_count, created_at, profiles:user_id ( full_name )')
    .order('upvote_count', { ascending: false })
    .limit(100)

  const { data: myUpvotes } = user
    ? await supabase.from('feature_request_upvotes').select('feature_request_id').eq('user_id', user.id)
    : { data: null }
  const myUpvotedIds = new Set((myUpvotes || []).map((u) => u.feature_request_id))

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">Feature Wishlist</h1>
          <p className="text-xl opacity-90">Suggest what Greyin should build next, and upvote what matters to you.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-indigo-600" />
            Suggest a feature
          </h2>
          {user ? (
            <form action="/api/wishlist/create" method="POST" className="space-y-3">
              <input
                name="title"
                type="text"
                required
                placeholder="What should we build?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <textarea
                name="description"
                rows={2}
                placeholder="Any more detail? (optional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <button type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 font-semibold text-sm">
                Submit
              </button>
            </form>
          ) : (
            <p className="text-sm text-gray-600">
              <a href="/login?next=/wishlist" className="text-indigo-600 hover:text-indigo-700 font-semibold">Sign in</a> to suggest a feature or upvote.
            </p>
          )}
        </div>

        <div className="space-y-3">
          {requests && requests.length > 0 ? (
            requests.map((r: any) => {
              const upvoted = myUpvotedIds.has(r.id)
              return (
                <div key={r.id} className="bg-white rounded-lg shadow p-5 flex items-start gap-4">
                  <form action="/api/wishlist/upvote" method="POST">
                    <input type="hidden" name="feature_request_id" value={r.id} />
                    <input type="hidden" name="action" value={upvoted ? 'remove' : 'add'} />
                    <button
                      type="submit"
                      disabled={!user}
                      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border text-sm font-semibold ${
                        upvoted ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                      } disabled:opacity-50`}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      {r.upvote_count}
                    </button>
                  </form>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{r.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                    </div>
                    {r.description && <p className="text-sm text-gray-600 mb-1">{r.description}</p>}
                    <p className="text-xs text-gray-400">Suggested by {r.profiles?.full_name || 'Member'}</p>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Lightbulb className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nothing suggested yet</h3>
              <p className="text-gray-600">Be the first to share an idea.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
