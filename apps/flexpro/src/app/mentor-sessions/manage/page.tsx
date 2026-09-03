import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, ArrowLeft, Plus } from 'lucide-react'

export default async function ManageMentorSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/mentor-sessions/manage')
  }

  // Cross-app read: is_mentor is set on the DeepEdge profile page,
  // same "check a shared profiles column, no cross-app call needed"
  // pattern already used elsewhere (e.g. greyin_scores/reputation_scores
  // reads).
  const { data: profile } = await supabase.from('profiles').select('is_mentor').eq('id', user.id).single()
  if (!profile?.is_mentor) {
    redirect('/dashboard')
  }

  const { data: gigs } = await supabase
    .from('gigs')
    .select('id, title, price_min, status')
    .eq('freelancer_id', user.id)
    .eq('is_mentor_session', true)
    .order('created_at', { ascending: false })

  const gigIds = (gigs || []).map((g) => g.id)
  // SEC-023 (2026-08-26 security audit): recording_url is column-locked
  // (076) -- selected separately below via get_visible_recording_urls,
  // which authorizes the mentor for their own slots' recordings.
  const { data: slots } = gigIds.length
    ? await supabase
        .from('mentor_session_slots')
        .select('id, gig_id, starts_at, ends_at, status, capacity, booked_count, recording_price')
        .in('gig_id', gigIds)
        .order('starts_at', { ascending: true })
    : { data: [] }

  const visibleRecordingUrls = new Map<string, string>()
  if (slots && slots.length > 0) {
    const { data: urls } = await supabase.rpc('get_visible_recording_urls', {
      p_slot_ids: slots.map((s) => s.id),
    })
    for (const u of urls || []) visibleRecordingUrls.set((u as any).slot_id, (u as any).recording_url)
  }

  const { data: packages } = gigIds.length
    ? await supabase
        .from('mentor_packages')
        .select('id, gig_id, title, session_count, price, active')
        .in('gig_id', gigIds)
        .order('created_at', { ascending: false })
    : { data: [] }

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
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Manage Mentor Sessions</h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5" />
            New session type
          </h2>
          <form action="/api/mentor-sessions/gigs" method="POST" className="space-y-3">
            <input name="title" type="text" required placeholder="e.g. 30-min career chat" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <textarea name="description" required rows={3} placeholder="What will this session cover?" className="w-full border border-gray-300 rounded-lg p-3 text-sm" />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="is_free" value="true" className="rounded" />
              This is a free session
            </label>
            <div>
              <label htmlFor="price" className="block text-xs text-gray-500 mb-1">Price in ₹ (ignored if free)</label>
              <input id="price" name="price" type="number" min={0} defaultValue={0} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40" />
            </div>
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold">
              Create
            </button>
          </form>
        </div>

        {gigs && gigs.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your session types &amp; slots</h2>
            <div className="space-y-6">
              {gigs.map((gig) => (
                <div key={gig.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-gray-900">{gig.title}</p>
                    <span className="text-sm text-indigo-600 font-semibold">
                      {gig.price_min > 0 ? `₹${gig.price_min.toLocaleString()}` : 'Free'}
                    </span>
                  </div>

                  <form action="/api/mentor-sessions/slots" method="POST" className="flex flex-wrap items-end gap-2 mb-3">
                    <input type="hidden" name="gig_id" value={gig.id} />
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Date</label>
                      <input name="date" type="date" required className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start</label>
                      <input name="start_time" type="time" required className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End</label>
                      <input name="end_time" type="time" required className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Seats</label>
                      <input name="capacity" type="number" min={1} defaultValue={1} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-20" title="1 = normal 1:1 session. More than 1 makes this a cohort/group session." />
                    </div>
                    <button type="submit" className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 text-sm font-semibold">
                      Add slot
                    </button>
                  </form>

                  <div className="space-y-2 mb-4">
                    {(slots || []).filter((s) => s.gig_id === gig.id).map((slot) => {
                      const isPast = new Date(slot.ends_at) < new Date()
                      return (
                        <div key={slot.id} className="text-sm border-b border-gray-100 pb-2 last:border-b-0">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">
                              {new Date(slot.starts_at).toLocaleString()} &ndash; {new Date(slot.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {' '}
                              <span className={slot.status === 'open' ? 'text-teal-600' : 'text-gray-400'}>({slot.status})</span>
                              {slot.capacity > 1 && (
                                <span className="ml-2 text-xs text-purple-600 font-medium">{slot.booked_count}/{slot.capacity} seats</span>
                              )}
                            </span>
                            {slot.status === 'open' && (
                              <form action={`/api/mentor-sessions/slots/${slot.id}/cancel`} method="POST">
                                <button type="submit" className="text-xs text-red-600 hover:text-red-700">Cancel</button>
                              </form>
                            )}
                          </div>
                          {isPast && !visibleRecordingUrls.has(slot.id) && (
                            <form action={`/api/mentor-sessions/slots/${slot.id}/recording`} method="POST" className="flex flex-wrap items-end gap-2 mt-2">
                              <input name="recording_url" type="url" required placeholder="Recording URL" className="border border-gray-300 rounded-lg px-2 py-1 text-xs flex-1 min-w-[160px]" />
                              <input name="recording_price" type="number" min={0} defaultValue={0} placeholder="Price ₹" className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-24" />
                              <button type="submit" className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-200 font-semibold">
                                Sell replay
                              </button>
                            </form>
                          )}
                          {visibleRecordingUrls.has(slot.id) && (
                            <p className="text-xs text-purple-600 mt-1">Replay for sale at ₹{slot.recording_price?.toLocaleString()}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Session packages</p>
                    {(packages || []).filter((p) => p.gig_id === gig.id).map((pkg) => (
                      <p key={pkg.id} className="text-xs text-gray-600 mb-1">
                        {pkg.title} &mdash; {pkg.session_count} sessions for ₹{pkg.price.toLocaleString()}
                      </p>
                    ))}
                    <form action="/api/mentor-sessions/packages" method="POST" className="flex flex-wrap items-end gap-2 mt-2">
                      <input type="hidden" name="gig_id" value={gig.id} />
                      <input name="title" type="text" required placeholder="e.g. 3-session bundle" className="border border-gray-300 rounded-lg px-2 py-1 text-xs flex-1 min-w-[140px]" />
                      <input name="session_count" type="number" min={2} defaultValue={3} className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-16" title="Number of sessions in the bundle" />
                      <input name="price" type="number" min={0} placeholder="Total price ₹" className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-28" />
                      <button type="submit" className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-200 font-semibold">
                        Add package
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
