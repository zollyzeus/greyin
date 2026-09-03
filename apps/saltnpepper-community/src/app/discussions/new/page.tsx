import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users, ArrowLeft } from 'lucide-react'

const CATEGORIES = ['Architecture Reviews', 'Career Transitions', 'Tool Evaluations', 'War Stories', 'Referrals & Intros']

export default async function NewDiscussionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/discussions/new')
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Users className="h-8 w-8 text-purple-600" />
              <span className="ml-2 text-2xl font-bold">Salt & Pepper</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/discussions" className="flex items-center text-gray-600 hover:text-purple-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to discussions
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Start a Discussion</h1>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action="/api/discussions/create" method="POST" className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
              <input id="title" name="title" type="text" required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                placeholder="What's on your mind?" />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
              <select id="category" name="category" defaultValue={CATEGORIES[0]}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="body" className="block text-sm font-medium text-gray-700">Details</label>
              <textarea id="body" name="body" rows={8} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                placeholder="Share the context..." />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="is_anonymous" value="true" className="rounded text-purple-600" />
              Post anonymously (your identity stays visible to admins for moderation, but other members will see &ldquo;Anonymous Member&rdquo;)
            </label>

            <div>
              <label htmlFor="feed_visibility" className="block text-sm font-medium text-gray-700">Show in followers&rsquo; feed</label>
              <select id="feed_visibility" name="feed_visibility" defaultValue="public"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500">
                <option value="public">Public</option>
                <option value="followers">Followers only</option>
                <option value="private">Don&rsquo;t include</option>
              </select>
            </div>

            <button type="submit"
              className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-semibold">
              Post Discussion
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
