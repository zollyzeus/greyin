import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, ArrowLeft, Clock } from 'lucide-react'

export default async function MentorSessionDetailPage({
  params,
  searchParams,
}: {
  params: { gigId: string }
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { error, success } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: gig } = await supabase
    .from('gigs')
    .select('id, title, description, price_min, freelancer_id, seller:profiles!freelancer_id(full_name)')
    .eq('id', params.gigId)
    .eq('is_mentor_session', true)
    .single()

  if (!gig) {
    notFound()
  }

  const { data: slots } = await supabase
    .from('mentor_session_slots')
    .select('id, starts_at, ends_at, capacity, booked_count')
    .eq('gig_id', gig.id)
    .eq('status', 'open')
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })

  const { data: packages } = await supabase
    .from('mentor_packages')
    .select('id, title, session_count, price')
    .eq('gig_id', gig.id)
    .eq('active', true)
    .order('created_at', { ascending: false })

  // SEC-023 (2026-08-26 security audit): recording_url is column-locked
  // (076) so a direct PostgREST read can no longer get a real recording
  // URL without having purchased access -- and since a REVOKE on a
  // column also blocks using it in a filter, not just the select list,
  // this now filters on recording_price (which stays public and is set
  // together with the url) as the "has a recording" signal instead.
  const { data: recordings } = await supabase
    .from('mentor_session_slots')
    .select('id, starts_at, recording_price')
    .eq('gig_id', gig.id)
    .not('recording_price', 'is', null)
    .order('starts_at', { ascending: false })

  // Session credits this buyer holds for THIS mentor's packages --
  // offered as a "use credit" option instead of paying again when
  // booking a slot below (062_mentor_monetization.sql).
  let myCredits: Array<{ id: string; sessions_remaining: number; title: string }> = []
  let recordingIdsOwned = new Set<string>()
  // Only ever populated with URLs the RPC actually authorized for this
  // caller (mentor, original buyer, or a genuine recording purchaser) --
  // see get_visible_recording_urls (076).
  let visibleRecordingUrls = new Map<string, string>()
  if (user) {
    const { data: purchases } = await supabase
      .from('mentor_package_purchases')
      .select('id, sessions_remaining, mentor_packages!inner(gig_id, title)')
      .eq('buyer_id', user.id)
      .gt('sessions_remaining', 0)
    myCredits = (purchases || [])
      .filter((p: any) => p.mentor_packages?.gig_id === gig.id)
      .map((p: any) => ({ id: p.id, sessions_remaining: p.sessions_remaining, title: p.mentor_packages.title }))

    const { data: owned } = await supabase
      .from('mentor_recording_purchases')
      .select('slot_id')
      .eq('buyer_id', user.id)
    recordingIdsOwned = new Set((owned || []).map((o) => o.slot_id))

    if (recordings && recordings.length > 0) {
      const { data: urls } = await supabase.rpc('get_visible_recording_urls', {
        p_slot_ids: recordings.map((r) => r.id),
      })
      visibleRecordingUrls = new Map((urls || []).map((u: any) => [u.slot_id, u.recording_url]))
    }
  }

  const seller = gig.seller as unknown as { full_name: string | null } | null

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Briefcase className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-2xl font-bold">FlexPro</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/mentor-sessions" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to mentor sessions
        </Link>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Booked using a session credit.
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{gig.title}</h1>
          <p className="text-sm text-gray-500 mb-4">with {seller?.full_name || 'a mentor'}</p>
          <p className="text-gray-700 whitespace-pre-wrap mb-4">{gig.description}</p>
          <p className="font-semibold text-indigo-600">
            {gig.price_min > 0 ? `₹${gig.price_min.toLocaleString()} per session` : 'Free'}
          </p>
        </div>

        {packages && packages.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Session packages</h2>
            <div className="space-y-3">
              {packages.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{pkg.title}</p>
                    <p className="text-xs text-gray-500">{pkg.session_count} sessions &middot; ₹{pkg.price.toLocaleString()}</p>
                  </div>
                  {user && user.id !== gig.freelancer_id ? (
                    <form action={`/api/mentor-sessions/packages/${pkg.id}/purchase`} method="POST">
                      <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 text-sm font-semibold">
                        Buy
                      </button>
                    </form>
                  ) : !user ? (
                    <Link href={`/login?next=/mentor-sessions/${gig.id}`} className="text-indigo-600 text-sm font-semibold hover:text-indigo-700">
                      Sign in
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Available times
          </h2>
          {slots && slots.length > 0 ? (
            <div className="space-y-2">
              {slots.map((slot) => {
                const isCohort = slot.capacity > 1
                const seatsLeft = slot.capacity - slot.booked_count
                return (
                  <div key={slot.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
                    <span className="text-sm text-gray-700">
                      {new Date(slot.starts_at).toLocaleString()} &ndash; {new Date(slot.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isCohort && <span className="ml-2 text-xs text-purple-600 font-medium">{seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left</span>}
                    </span>
                    {user ? (
                      user.id === gig.freelancer_id ? (
                        <span className="text-xs text-gray-400">This is your own slot</span>
                      ) : myCredits.length > 0 ? (
                        <form action={`/api/mentor-sessions/slots/${slot.id}/book-with-credit`} method="POST" className="flex items-center gap-2">
                          <select name="package_purchase_id" className="border border-gray-300 rounded-lg px-2 py-1 text-xs">
                            {myCredits.map((c) => (
                              <option key={c.id} value={c.id}>{c.title} ({c.sessions_remaining} left)</option>
                            ))}
                          </select>
                          <button type="submit" className="bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 text-xs font-semibold">
                            Use credit
                          </button>
                        </form>
                      ) : (
                        <form action={isCohort ? `/api/mentor-sessions/slots/${slot.id}/book-cohort` : '/api/mentor-sessions/book'} method="POST">
                          {!isCohort && <input type="hidden" name="slot_id" value={slot.id} />}
                          {!isCohort && <input type="hidden" name="gig_id" value={gig.id} />}
                          <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 text-sm font-semibold">
                            {isCohort ? 'Join' : 'Book'}
                          </button>
                        </form>
                      )
                    ) : (
                      <Link href={`/login?next=/mentor-sessions/${gig.id}`} className="text-indigo-600 text-sm font-semibold hover:text-indigo-700">
                        Sign in to book
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No open times right now.</p>
          )}
        </div>

        {recordings && recordings.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Past session replays</h2>
            <div className="space-y-3">
              {recordings.map((rec) => (
                <div key={rec.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-gray-700">{new Date(rec.starts_at).toLocaleDateString()} &middot; ₹{rec.recording_price?.toLocaleString()}</p>
                  {user && recordingIdsOwned.has(rec.id) && visibleRecordingUrls.has(rec.id) ? (
                    <a href={visibleRecordingUrls.get(rec.id)!} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm font-semibold hover:text-indigo-700">
                      Watch
                    </a>
                  ) : user && user.id !== gig.freelancer_id ? (
                    <form action={`/api/mentor-sessions/slots/${rec.id}/purchase-recording`} method="POST">
                      <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 text-sm font-semibold">
                        Buy access
                      </button>
                    </form>
                  ) : !user ? (
                    <Link href={`/login?next=/mentor-sessions/${gig.id}`} className="text-indigo-600 text-sm font-semibold hover:text-indigo-700">
                      Sign in
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
