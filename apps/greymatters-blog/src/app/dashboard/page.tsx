import Link from 'next/link'
import { createClient } from '@/app/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sweepUnscoredPosts } from '@/app/lib/post-quality'
import { PenTool, FileText, Settings, LogOut, ShieldCheck, Bell, Rss } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  // Safety-net catch-up for posts published/edited outside the in-app
  // CMS (chiefly Supabase Studio) -- see sweepUnscoredPosts' own comment
  // for why /dashboard specifically. Best-effort: never blocks the page
  // on a scoring failure, and if AI review is disabled this is just a
  // fast no-op (complete() never throws).
  await sweepUnscoredPosts()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false)

  const { data: tips } = await supabase
    .from('author_tips')
    .select('amount')
    .eq('author_id', user.id)
    .eq('status', 'paid')
  const totalTips = (tips || []).reduce((sum, t) => sum + t.amount, 0)

  const { data: myPosts } = await supabase
    .from('posts')
    .select('id, title, slug, created_at, feed_visibility')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Gap-audit item #10 -- personalized activity line, same pattern as
  // Longlist's dashboard (count-only query, plain-English sentence).
  const { count: publishedPostCount } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', user.id)
    .eq('status', 'published')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <a href="https://greyin.net" className="flex items-center gap-2 text-xl font-bold text-indigo-600">
              <PenTool className="w-6 h-6" />
              <span>GreyMatters</span>
            </a>
            <div className="flex items-center gap-4">
              <Link href="/feed" className="p-2" title="Feed">
                <Rss className="w-5 h-5" />
              </Link>
              <Link href="/notifications" className="relative p-2" title="Notifications">
                <Bell className="w-5 h-5" />
                {!!unreadCount && (
                  <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/profile" className="p-2" title="Profile">
                <Settings className="w-5 h-5" />
              </Link>
              <form action="/auth/logout" method="POST">
                <button className="flex items-center gap-2 px-4 py-2">
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-1">Welcome, {profile?.full_name || 'Author'}!</h1>
        <p className="text-sm text-gray-600 mb-4">
          {(publishedPostCount ?? 0) > 0
            ? `You have published ${publishedPostCount} post${publishedPostCount === 1 ? '' : 's'}.`
            : "You haven't published a post yet."}
        </p>
        {totalTips > 0 && (
          <p className="text-sm text-gray-600 mb-4">
            💙 You&apos;ve received <span className="font-semibold text-gray-900">₹{totalTips.toLocaleString()}</span> in reader tips.
            Payouts are processed manually — reach out to the team to withdraw.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/posts" className="p-6 bg-white rounded-lg shadow hover:shadow-lg">
            <FileText className="w-8 h-8 text-indigo-600 mb-2" />
            <h2 className="text-xl font-semibold">My Posts</h2>
            <p className="text-gray-600">View and manage your blog posts</p>
          </Link>
          <Link href="/posts/new" className="p-6 bg-white rounded-lg shadow hover:shadow-lg">
            <PenTool className="w-8 h-8 text-indigo-600 mb-2" />
            <h2 className="text-xl font-semibold">Write New Post</h2>
            <p className="text-gray-600">Create a new blog post</p>
          </Link>
          {profile?.role === 'admin' && (
            <Link href="/admin" className="p-6 bg-white rounded-lg shadow hover:shadow-lg">
              <ShieldCheck className="w-8 h-8 text-red-600 mb-2" />
              <h2 className="text-xl font-semibold">Admin</h2>
              <p className="text-gray-600">Moderate posts and comments</p>
            </Link>
          )}
        </div>

        {myPosts && myPosts.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">My recent activity</h2>
            <div className="divide-y">
              {myPosts.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                  <Link href={`/posts/${p.slug}`} className="font-medium text-gray-900 hover:text-indigo-600">
                    {p.title}
                  </Link>
                  <form action={`/api/posts/${p.id}/feed-visibility`} method="POST" className="flex items-center gap-2">
                    <select
                      name="feed_visibility"
                      defaultValue={p.feed_visibility}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1"
                    >
                      <option value="public">Public</option>
                      <option value="followers">Followers only</option>
                      <option value="private">Don&rsquo;t include</option>
                    </select>
                    <button type="submit" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                      Save
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
