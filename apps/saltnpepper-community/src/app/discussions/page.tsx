import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MessageCircle, PlusCircle, Clock, User } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { DiscussionVoteButtons } from '@/components/DiscussionVoteButtons'

const CATEGORIES = [
  { name: 'Architecture Reviews', icon: '🏗️' },
  { name: 'Career Transitions', icon: '🚀' },
  { name: 'Tool Evaluations', icon: '🔧' },
  { name: 'War Stories', icon: '⚡' },
  { name: 'Referrals & Intros', icon: '🤝' },
]

const SORTS = ['hot', 'new', 'top'] as const

export default async function DiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}) {
  const { sort: rawSort } = await searchParams
  const sort = SORTS.includes(rawSort as any) ? (rawSort as (typeof SORTS)[number]) : 'hot'
  const supabase = await createClient()

  let discussionsQuery = supabase
    .from('discussions')
    .select('id, title, body, category, reply_count, upvote_count, created_at, is_anonymous, profiles:author_id ( full_name, avatar_url )')
    .limit(50)

  if (sort === 'new') {
    discussionsQuery = discussionsQuery.order('created_at', { ascending: false })
  } else if (sort === 'top') {
    discussionsQuery = discussionsQuery.order('upvote_count', { ascending: false })
  } else {
    // 'hot' needs the score computed in JS below, so just fetch recent-ish
    // and re-sort — no stored/materialized score to keep updated without a
    // scheduler.
    discussionsQuery = discussionsQuery.order('created_at', { ascending: false })
  }

  const { data: rawDiscussions } = await discussionsQuery

  const { data: { user } } = await supabase.auth.getUser()
  const myVotes: Record<string, number> = {}
  if (user && rawDiscussions && rawDiscussions.length > 0) {
    const { data: votes } = await supabase
      .from('discussion_votes')
      .select('discussion_id, value')
      .eq('user_id', user.id)
      .in('discussion_id', rawDiscussions.map((d: any) => d.id))
    for (const v of votes || []) myVotes[v.discussion_id] = v.value
  }

  const discussions =
    sort === 'hot' && rawDiscussions
      ? [...rawDiscussions].sort((a, b) => hotScore(b) - hotScore(a))
      : rawDiscussions

  function hotScore(d: { upvote_count: number; reply_count: number; created_at: string }) {
    const ageHours = (Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60)
    return (d.upvote_count * 2 + d.reply_count) / Math.pow(ageHours + 2, 1.5)
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      {/* Hero */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">Community Discussions</h1>
          <p className="text-xl opacity-90">
            Connect with senior, experienced professionals. Share insights, get feedback, and grow together.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Categories Sidebar */}
          <aside className="w-64 flex-shrink-0 hidden lg:block">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-24 dark:bg-gray-900">
              <h2 className="font-semibold text-lg mb-4">Categories</h2>
              <div className="space-y-2">
                {CATEGORIES.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-2 p-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-xl">{cat.icon}</span>
                    <span className="font-medium">{cat.name}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/discussions/new"
                className="block w-full mt-6 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 font-semibold text-center flex items-center justify-center gap-2"
              >
                <PlusCircle className="h-5 w-5" />
                New Discussion
              </Link>
            </div>
          </aside>

          {/* Discussions Feed */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6 lg:hidden">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Discussions</h1>
              <Link
                href="/discussions/new"
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-semibold"
              >
                <PlusCircle className="h-4 w-4" />
                New
              </Link>
            </div>

            <div className="flex gap-2 mb-6">
              {SORTS.map((s) => (
                <Link
                  key={s}
                  href={`/discussions?sort=${s}`}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize ${
                    sort === s ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 dark:hover:border-purple-700'
                  }`}
                >
                  {s}
                </Link>
              ))}
            </div>

            {discussions && discussions.length > 0 ? (
              <div className="space-y-4">
                {discussions.map((d: any) => (
                  <Link
                    key={d.id}
                    href={`/discussions/${d.id}`}
                    className="block bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 dark:bg-gray-900"
                  >
                    <div className="flex gap-4">
                      <DiscussionVoteButtons
                        discussionId={d.id}
                        initialScore={d.upvote_count || 0}
                        initialMyVote={myVotes[d.id] || 0}
                        loggedIn={!!user}
                        size="sm"
                      />
                      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 dark:bg-purple-950/40">
                        <User className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1">
                        {d.category && (
                          <span className="inline-block px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold mb-2 dark:bg-purple-950/40 dark:text-purple-400">
                            {d.category}
                          </span>
                        )}
                        <h3 className="text-lg font-semibold text-gray-900 mb-1 dark:text-gray-50">{d.title}</h3>
                        <p className="text-gray-700 line-clamp-2 mb-3 dark:text-gray-300">{d.body}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">{d.is_anonymous ? 'Anonymous Member' : d.profiles?.full_name || 'Member'}</span>
                          <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{new Date(d.created_at).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" />{d.reply_count} replies</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center dark:bg-gray-900">
                <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2 dark:text-gray-50">No discussions yet</h3>
                <p className="text-gray-600 mb-6 dark:text-gray-400">Be the first to start a conversation!</p>
                <Link
                  href="/discussions/new"
                  className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-semibold"
                >
                  <PlusCircle className="h-5 w-5" />
                  Start a Discussion
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
