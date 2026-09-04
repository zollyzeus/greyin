import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, ArrowLeft, Rss } from 'lucide-react'
import { FeedCard } from '@/components/FeedCard'
import { ThemeToggle } from '@/components/ThemeToggle'

/**
 * DeepEdge's own feed -- open to any logged-in user (candidates and
 * employers alike), not gated to employers, unlike /employer/dashboard.
 */
export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/feed')
  }

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
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Building2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <span className="ml-2 text-2xl font-bold">DeepEdge</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-blue-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <Rss className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
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
            <p className="text-gray-600 mb-4 dark:text-gray-400">Browse companies and jobs to find people to follow.</p>
            <Link href="/companies" className="text-blue-600 font-semibold hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              Browse Companies &rarr;
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
