import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Calendar, PlusCircle, MapPin, Users, Video } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'

// Gap-audit item #7 (2026-08-31 code-level pass): Community Events &
// Resources / RSVP, net-new -- Emergent has this, Greyin had nothing
// equivalent. Mirrors discussions/page.tsx's shell (hero, card list,
// SiteHeader) for visual consistency with the rest of the app.
export default async function EventsPage() {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('events')
    .select('id, title, description, location, is_virtual, starts_at, capacity, profiles:host_id ( full_name ), event_rsvps ( user_id )')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(50)

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">Events & Resources</h1>
          <p className="text-xl opacity-90">
            Meetups, mentoring sessions, and peer learning hosted by the community.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Upcoming</h2>
          <Link
            href="/events/new"
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-semibold"
          >
            <PlusCircle className="h-4 w-4" />
            Host an Event
          </Link>
        </div>

        {events && events.length > 0 ? (
          <div className="space-y-4">
            {events.map((e: any) => {
              const rsvpCount = e.event_rsvps?.length || 0
              const full = e.capacity != null && rsvpCount >= e.capacity
              return (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="block bg-white rounded-lg shadow-md hover:shadow-lg transition p-6"
                >
                  <div className="flex gap-4">
                    <div className="w-14 h-14 bg-purple-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0 text-purple-700">
                      <span className="text-xs font-semibold uppercase">{new Date(e.starts_at).toLocaleDateString(undefined, { month: 'short' })}</span>
                      <span className="text-lg font-bold leading-none">{new Date(e.starts_at).getDate()}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{e.title}</h3>
                      <p className="text-gray-700 line-clamp-2 mb-3">{e.description}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          {e.is_virtual ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                          {e.is_virtual ? 'Virtual' : e.location || 'In person'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(e.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {rsvpCount}{e.capacity != null ? ` / ${e.capacity}` : ''} going{full ? ' — full' : ''}
                        </span>
                        <span className="font-medium">Hosted by {e.profiles?.full_name || 'Member'}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No upcoming events</h3>
            <p className="text-gray-600 mb-6">Be the first to host one.</p>
            <Link
              href="/events/new"
              className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-semibold"
            >
              <PlusCircle className="h-5 w-5" />
              Host an Event
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
