import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users, ArrowLeft } from 'lucide-react'

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/events/new')
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
        <Link href="/events" className="flex items-center text-gray-600 hover:text-purple-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to events
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Host an Event</h1>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action="/api/events/create" method="POST" className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
              <input id="title" name="title" type="text" required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                placeholder="Monthly architecture review" />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
              <textarea id="description" name="description" rows={5} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="starts_at" className="block text-sm font-medium text-gray-700">Starts</label>
                <input id="starts_at" name="starts_at" type="datetime-local" required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label htmlFor="ends_at" className="block text-sm font-medium text-gray-700">Ends (optional)</label>
                <input id="ends_at" name="ends_at" type="datetime-local"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="is_virtual" value="true" defaultChecked className="rounded text-purple-600" />
              This is a virtual event
            </label>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location / link (optional)</label>
              <input id="location" name="location" type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                placeholder="Zoom link, or a city/venue" />
            </div>

            <div>
              <label htmlFor="capacity" className="block text-sm font-medium text-gray-700">Capacity (optional)</label>
              <input id="capacity" name="capacity" type="number" min={1}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
            </div>

            <button type="submit"
              className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-semibold">
              Publish Event
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
