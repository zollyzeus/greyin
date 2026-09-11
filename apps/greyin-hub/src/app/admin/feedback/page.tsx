import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, MessageSquareHeart, Star } from 'lucide-react'

export default async function AdminFeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/feedback')
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: openFeedback } = await supabase
    .from('platform_feedback')
    .select('id, message, rating, source_app, created_at, profiles:user_id ( full_name, email )')
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(100)

  const { data: repliedFeedback } = await supabase
    .from('platform_feedback')
    .select('id, message, rating, source_app, admin_reply, replied_at, profiles:user_id ( full_name, email )')
    .eq('status', 'replied')
    .order('replied_at', { ascending: false })
    .limit(20)

  return (
    <>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to admin
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <MessageSquareHeart className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Feedback</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 mb-4 dark:text-gray-50">Awaiting reply ({openFeedback?.length || 0})</h2>
          {openFeedback && openFeedback.length > 0 ? (
            <div className="divide-y">
              {openFeedback.map((f: any) => (
                <div key={f.id} className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-50">{f.profiles?.full_name || f.profiles?.email}</span>
                      {f.source_app && <span className="text-xs text-gray-400 capitalize dark:text-gray-500">{f.source_app}</span>}
                      {f.rating && (
                        <span className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={`h-3.5 w-3.5 ${n <= f.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                          ))}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(f.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-700 mb-3 dark:text-gray-300">{f.message}</p>
                  <form action="/api/admin/feedback/reply" method="POST" className="flex items-start gap-2">
                    <input type="hidden" name="feedback_id" value={f.id} />
                    <textarea
                      name="admin_reply"
                      rows={2}
                      required
                      placeholder="Write a reply..."
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                    <button type="submit" className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 whitespace-nowrap">
                      Reply
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">Nothing awaiting reply.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 mb-4 dark:text-gray-50">Recently replied</h2>
          {repliedFeedback && repliedFeedback.length > 0 ? (
            <div className="divide-y">
              {repliedFeedback.map((f: any) => (
                <div key={f.id} className="py-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{f.profiles?.full_name || f.profiles?.email}</p>
                  <p className="text-sm text-gray-600 mb-1 dark:text-gray-400">{f.message}</p>
                  <p className="text-sm text-indigo-700 bg-indigo-50 rounded-lg px-3 py-1.5 inline-block dark:text-indigo-400 dark:bg-indigo-950/40">{f.admin_reply}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">Nothing replied to yet.</p>
          )}
        </div>
      </div>
    </>
  )
}
