import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sweepUnscoredReplies } from '@/lib/reply-quality'
import { summarizeThread } from '@/lib/thread-summary'
import { Users, ArrowLeft, User, Clock, Sparkles } from 'lucide-react'
import { FollowButton } from '@/components/FollowButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DiscussionVoteButtons } from '@/components/DiscussionVoteButtons'

export default async function DiscussionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: discussion } = await supabase
    .from('discussions')
    .select('*, profiles:author_id ( full_name )')
    .eq('id', id)
    .single()

  if (!discussion) {
    notFound()
  }

  const { data: replies } = await supabase
    .from('discussion_replies')
    .select('id, author_id, body, created_at, is_anonymous, profiles:author_id ( full_name )')
    .eq('discussion_id', id)
    .order('created_at', { ascending: true })

  // Lazy, bounded AI mentoring-quality catch-up for THIS thread's own
  // backlog -- fast feedback for whoever's actively reading it. The
  // platform-wide safety net (any thread, not just this one) runs from
  // /dashboard instead; see sweepUnscoredReplies' own comment.
  await sweepUnscoredReplies(3, id)

  const threadSummary = await summarizeThread(discussion.title, discussion.body, (replies || []).map((r) => ({ body: r.body })))

  const { data: myFollow } = user && discussion.author_id
    ? await supabase.from('user_follows').select('followed_id').eq('follower_id', user.id).eq('followed_id', discussion.author_id).maybeSingle()
    : { data: null }

  const { data: myVoteRow } = user
    ? await supabase.from('discussion_votes').select('value').eq('discussion_id', id).eq('user_id', user.id).maybeSingle()
    : { data: null }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <span className="ml-2 text-2xl font-bold">Salt & Pepper</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/discussions" className="flex items-center text-gray-600 hover:text-purple-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to discussions
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8 mb-6 dark:bg-gray-900 flex gap-6">
          <DiscussionVoteButtons
            discussionId={discussion.id}
            initialScore={discussion.upvote_count || 0}
            initialMyVote={myVoteRow?.value || 0}
            loggedIn={!!user}
          />
          <div className="flex-1">
          {discussion.category && (
            <span className="inline-block px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold mb-3 dark:bg-purple-950/40 dark:text-purple-400">
              {discussion.category}
            </span>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-4 dark:text-gray-50">{discussion.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-6 dark:text-gray-400">
            <span className="flex items-center gap-1"><User className="h-4 w-4" />{discussion.is_anonymous ? 'Anonymous Member' : discussion.profiles?.full_name || 'Member'}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{new Date(discussion.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-gray-700 whitespace-pre-line dark:text-gray-300">{discussion.body}</p>
          {/* Anonymous discussions never expose author_id to follow -- the
              button is simply not rendered, matching how their name is
              already suppressed above. */}
          {user && !discussion.is_anonymous && discussion.author_id && user.id !== discussion.author_id && (
            <FollowButton
              targetUserId={discussion.author_id}
              isFollowing={!!myFollow}
              next={`/discussions/${id}`}
            />
          )}
          </div>
        </div>

        {threadSummary && (
          <details className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 dark:bg-purple-950/30 dark:border-purple-900">
            <summary className="flex items-center gap-2 text-sm font-semibold text-purple-700 cursor-pointer select-none dark:text-purple-400">
              <Sparkles className="h-4 w-4" />
              AI summary of this thread
            </summary>
            <p className="text-sm text-gray-700 mt-3 dark:text-gray-300">{threadSummary}</p>
          </details>
        )}

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 dark:text-gray-50">
            {replies?.length || 0} {replies?.length === 1 ? 'Reply' : 'Replies'}
          </h2>

          <div className="space-y-4 mb-6">
            {replies?.map((reply: any) => (
              <div key={reply.id} className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-50">{reply.is_anonymous ? 'Anonymous Member' : reply.profiles?.full_name || 'Member'}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(reply.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-gray-700 whitespace-pre-line dark:text-gray-300">{reply.body}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
                {decodeURIComponent(error)}
              </div>
            )}
            {user ? (
              <form action={`/api/discussions/${id}/reply`} method="POST">
                <textarea
                  name="body"
                  required
                  rows={4}
                  placeholder="Add your reply..."
                  className="w-full border border-gray-300 rounded-lg p-4 mb-4 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <label className="flex items-center gap-2 text-sm text-gray-700 mb-4 dark:text-gray-300">
                  <input type="checkbox" name="is_anonymous" value="true" className="rounded text-purple-600 dark:text-purple-400 dark:bg-gray-950 dark:text-gray-100" />
                  Reply anonymously
                </label>
                <button type="submit" className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-semibold">
                  Post Reply
                </button>
              </form>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">
                <Link href={`/login?next=/discussions/${id}`} className="text-purple-600 hover:text-purple-700 font-semibold dark:text-purple-400 dark:hover:text-purple-300">
                  Sign in
                </Link>{' '}
                to reply.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
