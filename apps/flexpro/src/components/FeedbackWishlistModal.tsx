'use client'

import { useEffect, useState } from 'react'
import { MessageSquareHeart, Star, Lightbulb, ThumbsUp, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const OWN_PILLAR = 'flexpro'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  planned: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  shipped: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  declined: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
}

interface FeedbackRow {
  id: string
  message: string
  rating: number | null
  status: string
  admin_reply: string | null
  created_at: string
}

interface FeatureRequestRow {
  id: string
  title: string
  description: string | null
  status: string
  upvote_count: number
}

/**
 * UI/UX elevation plan, Phase 4 -- feedback + wishlist as an in-app modal
 * in the shell, replacing the cross-domain `greyin.net/feedback?app=...`
 * link every SiteHeader's "Explore" dropdown has carried since 101. Ports
 * greyin-hub's own /feedback and /wishlist pages, which stay in place as
 * the fallback destination for logged-out visitors -- this modal is only
 * ever mounted inside WorkspaceShell, which is itself gated to
 * authenticated pages.
 *
 * Reads/writes platform_feedback and feature_requests/feature_request_upvotes
 * directly via this app's own Supabase client rather than calling Hub's
 * API routes: real SSO (the shared .greyin.net cookie, lib/supabase/server.ts)
 * means the same user/JWT and the same RLS policies (101_wishlist_and_feedback.sql)
 * already apply identically from any pillar app -- no CORS, no cross-origin
 * fetch, no new API surface needed, same "per-app duplication, one shared
 * Supabase backend" convention as SectionBadge/NotificationBell.
 */
export function FeedbackWishlistModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [supabase] = useState(() => createClient())
  const [tab, setTab] = useState<'feedback' | 'wishlist'>('feedback')
  const [userId, setUserId] = useState<string | null>(null)

  const [myFeedback, setMyFeedback] = useState<FeedbackRow[]>([])
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  const [requests, setRequests] = useState<FeatureRequestRow[]>([])
  const [myUpvotedIds, setMyUpvotedIds] = useState<Set<string>>(new Set())
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [submittingRequest, setSubmittingRequest] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active || !user) return
      setUserId(user.id)

      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('type', 'feedback_replied').eq('read', false)

      const { data: feedback } = await supabase
        .from('platform_feedback')
        .select('id, message, rating, status, admin_reply, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (active && feedback) setMyFeedback(feedback as FeedbackRow[])

      const { data: featureRequests } = await supabase
        .from('feature_requests')
        .select('id, title, description, status, upvote_count')
        .order('upvote_count', { ascending: false })
        .limit(50)
      if (active && featureRequests) setRequests(featureRequests as FeatureRequestRow[])

      const { data: upvotes } = await supabase.from('feature_request_upvotes').select('feature_request_id').eq('user_id', user.id)
      if (active && upvotes) setMyUpvotedIds(new Set(upvotes.map((u) => u.feature_request_id)))
    })

    return () => {
      active = false
    }
  }, [open, supabase])

  if (!open) return null

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !message.trim()) return
    setSubmittingFeedback(true)
    const { error } = await supabase.from('platform_feedback').insert({
      user_id: userId,
      message: message.trim(),
      source_app: OWN_PILLAR,
      rating,
    })
    setSubmittingFeedback(false)
    if (!error) {
      setMessage('')
      setRating(null)
      const { data } = await supabase
        .from('platform_feedback')
        .select('id, message, rating, status, admin_reply, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (data) setMyFeedback(data as FeedbackRow[])
    }
  }

  const submitFeatureRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !newTitle.trim()) return
    setSubmittingRequest(true)
    const { error } = await supabase.from('feature_requests').insert({
      user_id: userId,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
    })
    setSubmittingRequest(false)
    if (!error) {
      setNewTitle('')
      setNewDescription('')
      const { data } = await supabase
        .from('feature_requests')
        .select('id, title, description, status, upvote_count')
        .order('upvote_count', { ascending: false })
        .limit(50)
      if (data) setRequests(data as FeatureRequestRow[])
    }
  }

  const toggleUpvote = async (requestId: string) => {
    if (!userId) return
    const upvoted = myUpvotedIds.has(requestId)
    setMyUpvotedIds((prev) => {
      const next = new Set(prev)
      if (upvoted) next.delete(requestId)
      else next.add(requestId)
      return next
    })
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, upvote_count: r.upvote_count + (upvoted ? -1 : 1) } : r))
    )
    if (upvoted) {
      await supabase.from('feature_request_upvotes').delete().eq('feature_request_id', requestId).eq('user_id', userId)
    } else {
      await supabase.from('feature_request_upvotes').insert({ feature_request_id: requestId, user_id: userId })
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-16 px-4" role="dialog" aria-modal="true" aria-label="Feedback and wishlist">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg max-h-[80vh] flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTab('feedback')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'feedback' ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`}
            >
              Feedback
            </button>
            <button
              type="button"
              onClick={() => setTab('wishlist')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'wishlist' ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`}
            >
              Wishlist
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'feedback' ? (
            <>
              <form onSubmit={submitFeedback} className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-50">
                  <MessageSquareHeart className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  Share your feedback
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(n === rating ? null : n)} aria-label={`${n} star`}>
                      <Star className={`h-6 w-6 ${rating && n <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  required
                  placeholder="What's on your mind?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <button
                  type="submit"
                  disabled={submittingFeedback || !message.trim()}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-semibold text-sm disabled:opacity-50"
                >
                  {submittingFeedback ? 'Sending...' : 'Send feedback'}
                </button>
              </form>

              {myFeedback.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Your feedback history</h3>
                  {myFeedback.map((f) => (
                    <div key={f.id} className="border border-gray-200 rounded-lg p-3 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-1.5">
                        {f.rating && (
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star key={n} className={`h-3.5 w-3.5 ${n <= f.rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                            ))}
                          </div>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${f.status === 'replied' ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                          {f.status === 'replied' ? 'Replied' : 'Awaiting reply'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{f.message}</p>
                      {f.admin_reply && (
                        <div className="mt-2 pl-3 border-l-2 border-orange-200 text-sm text-gray-700 dark:border-orange-900 dark:text-gray-300">
                          <p className="font-medium text-orange-700 dark:text-orange-400 text-xs mb-0.5">Team reply</p>
                          {f.admin_reply}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <form onSubmit={submitFeatureRequest} className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-50">
                  <Lightbulb className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  Suggest a feature
                </div>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  type="text"
                  required
                  placeholder="What should we build?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  placeholder="Any more detail? (optional)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <button
                  type="submit"
                  disabled={submittingRequest || !newTitle.trim()}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-semibold text-sm disabled:opacity-50"
                >
                  {submittingRequest ? 'Submitting...' : 'Submit'}
                </button>
              </form>

              <div className="space-y-2">
                {requests.length > 0 ? (
                  requests.map((r) => {
                    const upvoted = myUpvotedIds.has(r.id)
                    return (
                      <div key={r.id} data-testid="wishlist-item" className="flex items-start gap-3 border border-gray-200 rounded-lg p-3 dark:border-gray-800">
                        <button
                          type="button"
                          onClick={() => toggleUpvote(r.id)}
                          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shrink-0 ${
                            upvoted ? 'bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-400' : 'border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400'
                          }`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                          {r.upvote_count}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{r.title}</p>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                          </div>
                          {r.description && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{r.description}</p>}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">Nothing suggested yet. Be the first.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
