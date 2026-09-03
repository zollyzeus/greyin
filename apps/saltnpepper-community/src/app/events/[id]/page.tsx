import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users, ArrowLeft, Calendar, MapPin, Video, User } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: event } = await supabase
    .from('events')
    .select('*, profiles:host_id ( full_name )')
    .eq('id', id)
    .single()

  if (!event) {
    notFound()
  }

  const { data: rsvps } = await supabase
    .from('event_rsvps')
    .select('user_id, profiles:user_id ( full_name )')
    .eq('event_id', id)

  const rsvpCount = rsvps?.length || 0
  const full = event.capacity != null && rsvpCount >= event.capacity
  const isGoing = !!user && !!rsvps?.some((r: any) => r.user_id === user.id)
  const isHost = !!user && user.id === event.host_id

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/events" className="flex items-center text-gray-600 hover:text-purple-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to events
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{event.title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6">
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{new Date(event.starts_at).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}</span>
            <span className="flex items-center gap-1">
              {event.is_virtual ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              {event.is_virtual ? (event.location || 'Virtual') : event.location || 'In person'}
            </span>
            <span className="flex items-center gap-1"><User className="h-4 w-4" />Hosted by {event.profiles?.full_name || 'Member'}</span>
          </div>

          <p className="text-gray-700 whitespace-pre-line mb-6">{event.description}</p>

          <div className="flex items-center justify-between border-t pt-4">
            <span className="flex items-center gap-1 text-sm text-gray-600">
              <Users className="h-4 w-4" />
              {rsvpCount}{event.capacity != null ? ` / ${event.capacity}` : ''} going
            </span>

            {user ? (
              isHost ? (
                <span className="text-sm text-gray-500">You&rsquo;re hosting this event.</span>
              ) : (
                <form action={`/api/events/${id}/rsvp`} method="POST">
                  <input type="hidden" name="action" value={isGoing ? 'cancel' : 'rsvp'} />
                  <button
                    type="submit"
                    disabled={!isGoing && full}
                    className={`px-6 py-2 rounded-lg font-semibold text-sm ${
                      isGoing
                        ? 'border-2 border-purple-600 text-purple-600 hover:bg-purple-50'
                        : full
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {isGoing ? "I'm going ✓ (cancel)" : full ? 'Full' : "I'm going"}
                  </button>
                </form>
              )
            ) : (
              <Link href={`/login?next=/events/${id}`} className="text-purple-600 hover:text-purple-700 font-semibold text-sm">
                Sign in to RSVP
              </Link>
            )}
          </div>
        </div>

        {rsvpCount > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Who&rsquo;s going</h2>
            <div className="flex flex-wrap gap-2">
              {rsvps?.map((r: any) => (
                <span key={r.user_id} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                  {r.profiles?.full_name || 'Member'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
