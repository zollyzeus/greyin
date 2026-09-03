import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, ArrowLeft, Rss } from 'lucide-react'
import { FeedCard } from '@/components/FeedCard'

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
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Briefcase className="h-8 w-8 text-orange-600" />
              <span className="ml-2 text-2xl font-bold">FlexPro</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-orange-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <Rss className="h-6 w-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Feed</h1>
        </div>

        {items && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <FeedCard key={`${item.content_type}-${item.id}`} item={item} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Rss className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nobody you follow has posted anything yet</h3>
            <p className="text-gray-600 mb-4">Follow sellers from their gigs to see their activity here.</p>
            <Link href="/gigs" className="text-orange-600 font-semibold hover:text-orange-700">
              Browse Gigs &rarr;
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
