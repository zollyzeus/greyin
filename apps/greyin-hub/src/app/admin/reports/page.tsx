import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Flag } from 'lucide-react'

// Centralized moderation queue for content_reports (152) -- one shared
// table across every reportable content type, so this is the single
// place an admin checks rather than three separate per-pillar UIs. Each
// report also already paged every admin via the shared notifications
// bell at submit time (submit_content_report()); this page is where
// they act on it.
export default async function AdminReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/reports')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: reports } = await supabase
    .from('content_reports')
    .select('id, content_type, content_id, reason, status, created_at, resolved_at, admin_notes')
    .order('created_at', { ascending: false })
    .limit(100)

  const open = (reports || []).filter((r) => r.status === 'open')
  const resolved = (reports || []).filter((r) => r.status !== 'open').slice(0, 20)

  // Batch-fetch the actual reported content per type, rather than one
  // query per report -- same shape as the admin/longlist page's own
  // subscriber-count batching.
  const reviewIds = (reports || []).filter((r) => r.content_type === 'company_review').map((r) => r.content_id)
  const { data: reviews } = reviewIds.length
    ? await supabase.from('company_reviews').select('id, rating, review_text, company_id, companies ( name )').in('id', reviewIds)
    : { data: [] }
  const reviewById = new Map((reviews || []).map((r: any) => [r.id, r]))

  const conversationIds = (reports || []).filter((r) => r.content_type === 'direct_message').map((r) => r.content_id)
  const { data: participants } = conversationIds.length
    ? await supabase.from('conversation_participants').select('conversation_id, profiles ( full_name )').in('conversation_id', conversationIds)
    : { data: [] }
  const participantsByConversation = new Map<string, string[]>()
  for (const p of participants || []) {
    const arr = participantsByConversation.get(p.conversation_id) || []
    arr.push((p as any).profiles?.full_name || 'Unknown')
    participantsByConversation.set(p.conversation_id, arr)
  }
  const { data: recentMessages } = conversationIds.length
    ? await supabase.from('direct_messages').select('conversation_id, body, created_at').in('conversation_id', conversationIds).order('created_at', { ascending: false }).limit(200)
    : { data: [] }
  const lastMessageByConversation = new Map<string, string>()
  for (const m of recentMessages || []) {
    if (!lastMessageByConversation.has(m.conversation_id)) lastMessageByConversation.set(m.conversation_id, m.body)
  }

  const commentIds = (reports || []).filter((r) => r.content_type === 'greymatters_comment').map((r) => r.content_id)
  const { data: comments } = commentIds.length
    ? await supabase.from('comments').select('id, content, status, posts ( title, slug )').in('id', commentIds)
    : { data: [] }
  const commentById = new Map((comments || []).map((c: any) => [c.id, c]))

  function renderContent(report: { content_type: string; content_id: string }) {
    if (report.content_type === 'company_review') {
      const r: any = reviewById.get(report.content_id)
      if (!r) return <p className="text-sm text-gray-400 italic dark:text-gray-500">Review no longer exists.</p>
      return (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <p className="font-medium">{r.companies?.name || 'Unknown company'} &middot; {r.rating}/5</p>
          {r.review_text && <p className="mt-1">{r.review_text}</p>}
        </div>
      )
    }
    if (report.content_type === 'direct_message') {
      const names = participantsByConversation.get(report.content_id) || []
      const last = lastMessageByConversation.get(report.content_id)
      return (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <p className="font-medium">Conversation: {names.join(' & ') || 'Unknown participants'}</p>
          {last && <p className="mt-1 italic">Most recent: &ldquo;{last}&rdquo;</p>}
        </div>
      )
    }
    if (report.content_type === 'greymatters_comment') {
      const c: any = commentById.get(report.content_id)
      if (!c) return <p className="text-sm text-gray-400 italic dark:text-gray-500">Comment no longer exists.</p>
      return (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <p className="font-medium">On &ldquo;{c.posts?.title || 'Unknown post'}&rdquo; &middot; status: {c.status}</p>
          <p className="mt-1">{c.content}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Flag className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Content Reports</h1>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
        <h2 className="text-lg font-semibold mb-1 dark:text-gray-50">Open reports ({open.length})</h2>
        <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
          Company reviews, direct-message conversations, and GreyMatters comments members have reported.
        </p>
        {open.length > 0 ? (
          <div className="divide-y dark:divide-gray-800">
            {open.map((report) => (
              <div key={report.id} className="py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 dark:text-gray-500">
                  {report.content_type.replace(/_/g, ' ')} &middot; reported {new Date(report.created_at).toLocaleDateString()}
                </p>
                {renderContent(report)}
                <p className="text-sm text-gray-500 mt-2 dark:text-gray-400"><span className="font-medium">Reason:</span> {report.reason}</p>
                <form action="/api/admin/reports/resolve" method="POST" className="mt-3 flex gap-2">
                  <input type="hidden" name="report_id" value={report.id} />
                  <button type="submit" name="status" value="resolved" className="text-sm font-medium text-green-700 hover:text-green-800 dark:text-green-400">
                    Mark resolved
                  </button>
                  <button type="submit" name="status" value="dismissed" className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400">
                    Dismiss
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm dark:text-gray-400">Nothing open right now.</p>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4 dark:text-gray-50">Recently resolved</h2>
          <div className="divide-y dark:divide-gray-800">
            {resolved.map((report) => (
              <div key={report.id} className="py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {report.content_type.replace(/_/g, ' ')} &middot; {report.status} {report.resolved_at ? new Date(report.resolved_at).toLocaleDateString() : ''}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{report.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
