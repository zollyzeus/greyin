import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ImageUploader } from '@/components/ImageUploader'
import { GigQualityAssist } from '@/components/GigQualityAssist'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function NewGigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/gigs/new')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: categories } = await supabase
    .from('gig_categories')
    .select('id, name')
    .order('name')

  return (
    <WorkspaceShell
      activeSection="gigs"
      role={profile?.role}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="List a Gig"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 mb-1 dark:text-gray-50">List a Gig</h1>
          <p className="text-gray-600 mb-6 dark:text-gray-400">A FlexPro Pro subscription unlocks listing — plus a modest service fee when a gig is completed.</p>

          <form action="/api/gigs/create" method="POST" className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gig title</label>
              <input id="title" name="title" type="text" required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="I will build a real-time CAN bus dashboard" />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea id="description" name="description" rows={6} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <GigQualityAssist />

            <div>
              <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <select id="category_id" name="category_id" required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="price_min" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Price min</label>
                <input id="price_min" name="price_min" type="number" min={0} required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
              <div>
                <label htmlFor="price_max" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Price max</label>
                <input id="price_max" name="price_max" type="number" min={0}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
              <div>
                <label htmlFor="delivery_days" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Delivery (days)</label>
                <input id="delivery_days" name="delivery_days" type="number" min={1} defaultValue={7}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Cover image</label>
              <ImageUploader name="image_url" folder="gig-images" />
            </div>

            <div>
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tags (comma separated)</label>
              <input id="tags" name="tags" type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="CAN bus, embedded, dashboards" />
            </div>

            <div>
              <label htmlFor="feed_visibility" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Show in followers&rsquo; feed</label>
              <select id="feed_visibility" name="feed_visibility" defaultValue="public"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="public">Public</option>
                <option value="followers">Followers only</option>
                <option value="private">Don&rsquo;t include</option>
              </select>
            </div>

            <button type="submit"
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold">
              Publish Gig
            </button>
          </form>
        </div>
      </div>
    </WorkspaceShell>
  )
}
