import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, ArrowLeft } from 'lucide-react'
import { ImageUploader } from '@/components/ImageUploader'
import { GigQualityAssist } from '@/components/GigQualityAssist'

export default async function NewGigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/gigs/new')
  }

  const { data: categories } = await supabase
    .from('gig_categories')
    .select('id, name')
    .order('name')

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Briefcase className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold">FlexPro</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gigs" className="flex items-center text-gray-600 hover:text-blue-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to gigs
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">List a Gig</h1>
          <p className="text-gray-600 mb-6">A FlexPro Pro subscription unlocks listing — plus a modest service fee when a gig is completed.</p>

          <form action="/api/gigs/create" method="POST" className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">Gig title</label>
              <input id="title" name="title" type="text" required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="I will build a real-time CAN bus dashboard" />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
              <textarea id="description" name="description" rows={6} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>

            <GigQualityAssist />

            <div>
              <label htmlFor="category_id" className="block text-sm font-medium text-gray-700">Category</label>
              <select id="category_id" name="category_id" required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="price_min" className="block text-sm font-medium text-gray-700">Price min</label>
                <input id="price_min" name="price_min" type="number" min={0} required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label htmlFor="price_max" className="block text-sm font-medium text-gray-700">Price max</label>
                <input id="price_max" name="price_max" type="number" min={0}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label htmlFor="delivery_days" className="block text-sm font-medium text-gray-700">Delivery (days)</label>
                <input id="delivery_days" name="delivery_days" type="number" min={1} defaultValue={7}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cover image</label>
              <ImageUploader name="image_url" folder="gig-images" />
            </div>

            <div>
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700">Tags (comma separated)</label>
              <input id="tags" name="tags" type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="CAN bus, embedded, dashboards" />
            </div>

            <div>
              <label htmlFor="feed_visibility" className="block text-sm font-medium text-gray-700">Show in followers&rsquo; feed</label>
              <select id="feed_visibility" name="feed_visibility" defaultValue="public"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
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
    </main>
  )
}
