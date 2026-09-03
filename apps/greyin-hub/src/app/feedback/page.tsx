import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { MessageSquareHeart, Star } from 'lucide-react'

// Gap-audit item #3: general user feedback + admin reply loop.
// Centralized on Hub (user decision, 2026-09-02) rather than duplicated
// into all 6 pillar apps -- SSO (shared .greyin.net cookie) means any
// pillar-app user reaches this with zero extra login friction; each
// pillar's SiteHeader carries one nav link out here with a `?app=`
// param instead of its own duplicated page + route. Requires login (no
// anonymous submission, user decision) -- consistent with every other
// write path in this codebase.
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string; success?: string; error?: string }>
}) {
  const { app, success, error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: myFeedback } = user
    ? await supabase
        .from('platform_feedback')
        .select('id, message, rating, source_app, status, admin_reply, replied_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    : { data: null }

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">Feedback</h1>
          <p className="text-xl opacity-90">Tell us what&rsquo;s working, what isn&rsquo;t, or what you&rsquo;d like to see.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {success && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Thanks for the feedback — the team will take a look.
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        {user ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquareHeart className="h-5 w-5 text-indigo-600" />
              Share your feedback
            </h2>
            <form action="/api/feedback/create" method="POST" className="space-y-4">
              {app && <input type="hidden" name="source_app" value={app} />}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating (optional)</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="cursor-pointer">
                      <input type="radio" name="rating" value={n} className="peer sr-only" />
                      <Star className="h-7 w-7 text-gray-300 peer-checked:text-amber-400 peer-checked:fill-amber-400 hover:text-amber-300" />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Your feedback</label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  required
                  placeholder="What's on your mind?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <button type="submit" className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold text-sm">
                Send feedback
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8 text-sm text-gray-600">
            <a href={`/login?next=/feedback${app ? `?app=${app}` : ''}`} className="text-indigo-600 hover:text-indigo-700 font-semibold">Sign in</a> to send feedback.
          </div>
        )}

        {myFeedback && myFeedback.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-3">Your feedback history</h2>
            <div className="space-y-3">
              {myFeedback.map((f) => (
                <div key={f.id} className="bg-white rounded-lg shadow p-5">
                  <div className="flex items-center justify-between mb-2">
                    {f.rating && (
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-4 w-4 ${n <= f.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                        ))}
                      </div>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${f.status === 'replied' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {f.status === 'replied' ? 'Replied' : 'Awaiting reply'}
                    </span>
                  </div>
                  <p className="text-gray-700 mb-2">{f.message}</p>
                  {f.admin_reply && (
                    <div className="mt-3 pl-4 border-l-2 border-indigo-200 text-sm text-gray-700 bg-indigo-50/50 rounded-r-lg py-2 pr-3">
                      <p className="font-medium text-indigo-700 mb-1">Team reply</p>
                      {f.admin_reply}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
