import Link from 'next/link'
import { createClient } from '@/app/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sweepUnscoredPosts } from '@/app/lib/post-quality'
import { PenTool, FileText, ShieldCheck } from 'lucide-react'
import { EcosystemWidget } from '@/app/components/EcosystemWidget'
import { WorkspaceShell } from '@/app/components/WorkspaceShell'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const { data: scoreRow } = await supabase
    .from('greyin_scores')
    .select('greyin_score, is_verified_expert')
    .eq('user_id', user.id)
    .maybeSingle()

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

  const { data: memberships } = await supabase
    .from('pillar_memberships')
    .select('pillar')
    .eq('user_id', user.id)

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
    <WorkspaceShell
      activeSection="dashboard"
      isAdmin={profile?.role === 'admin'}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Dashboard"
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-1">Welcome, {profile?.full_name || 'Author'}!</h1>
        <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
          {(publishedPostCount ?? 0) > 0
            ? `You have published ${publishedPostCount} post${publishedPostCount === 1 ? '' : 's'}.`
            : "You haven't published a post yet."}
        </p>
        {totalTips > 0 && (
          <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
            💙 You&apos;ve received <span className="font-semibold text-gray-900 dark:text-gray-50">₹{totalTips.toLocaleString()}</span> in reader tips.
            Payouts are processed manually — reach out to the team to withdraw.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/posts" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
            <FileText className="w-8 h-8 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="text-xl font-semibold">My Posts</h2>
            <p className="text-gray-600 dark:text-gray-400">View and manage your blog posts</p>
          </Link>
          <Link href="/posts/new" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
            <PenTool className="w-8 h-8 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="text-xl font-semibold">Write New Post</h2>
            <p className="text-gray-600 dark:text-gray-400">Create a new blog post</p>
          </Link>
          {profile?.role === 'admin' && (
            <Link href="/admin" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
              <ShieldCheck className="w-8 h-8 text-red-600 mb-2 dark:text-red-400" />
              <h2 className="text-xl font-semibold">Admin</h2>
              <p className="text-gray-600 dark:text-gray-400">Moderate posts and comments</p>
            </Link>
          )}
        </div>

        {myPosts && myPosts.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold mb-4">My recent activity</h2>
            <div className="divide-y">
              {myPosts.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                  <Link href={`/posts/${p.slug}`} className="font-medium text-gray-900 hover:text-indigo-600 dark:text-gray-50">
                    {p.title}
                  </Link>
                  <form action={`/api/posts/${p.id}/feed-visibility`} method="POST" className="flex items-center gap-2">
                    <select
                      name="feed_visibility"
                      defaultValue={p.feed_visibility}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    >
                      <option value="public">Public</option>
                      <option value="followers">Followers only</option>
                      <option value="private">Don&rsquo;t include</option>
                    </select>
                    <button type="submit" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                      Save
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8">
          <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />
        </div>
      </div>
    </WorkspaceShell>
  )
}
