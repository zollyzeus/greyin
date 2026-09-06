import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/server'
import { Rss } from 'lucide-react'
import { FeedCard } from '@/app/components/FeedCard'
import { WorkspaceShell } from '@/app/components/WorkspaceShell'

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/feed')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: follows } = await supabase
    .from('user_follows')
    .select('followed_id')
    .eq('follower_id', user.id)
  const followedIds = (follows || []).map((f) => f.followed_id)

  const { data: items } = followedIds.length
    ? await supabase
        .from('activity_feed')
        .select('*')
        .in('author_id', followedIds)
        .neq('feed_visibility', 'private')
        .order('occurred_at', { ascending: false })
        .limit(50)
    : { data: [] }

  return (
    <WorkspaceShell
      activeSection="feed"
      isAdmin={profile?.role === 'admin'}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Feed"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Rss className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Feed</h1>
        </div>

        {items && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <FeedCard key={`${item.content_type}-${item.id}`} item={item} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center dark:bg-gray-900">
            <Rss className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2 dark:text-gray-50">Nobody you follow has posted anything yet</h3>
            <p className="text-gray-600 mb-4 dark:text-gray-400">Follow authors from their posts to see their activity here.</p>
            <Link href="/" className="text-blue-600 font-semibold hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              Browse Posts &rarr;
            </Link>
          </div>
        )}
      </div>
    </WorkspaceShell>
  )
}
