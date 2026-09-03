import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Compass, Save } from 'lucide-react'
import Link from 'next/link'
import { EcosystemWidget } from '@/components/EcosystemWidget'

// Deliberately lean -- every other pillar already has a full profile
// editor (bio, avatar, socials) against the same shared profiles row.
// This page only owns the one field that's genuinely Longlist's: what a
// member says about where their career is headed, which feeds the AI
// matching a company sees alongside its explicit subscribers.
export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/profile')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, future_interests, future_interests_note')
    .eq('id', user.id)
    .single()

  const { data: memberships } = await supabase
    .from('pillar_memberships')
    .select('pillar')
    .eq('user_id', user.id)

  const { data: subscriptions } = await supabase
    .from('future_role_subscriptions')
    .select('id, created_at, future_roles_public:future_role_id ( id, title, target_timeframe )')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/dashboard" className="text-amber-700 hover:text-amber-800">← Back to Dashboard</Link>
            <h1 className="text-xl font-semibold">Your Future Interests</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-700" />
            Where you're headed
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Optional. This is the signal AI matching uses to surface you to a company&rsquo;s posted future
            role even if you never subscribed to it yourself — your name is only ever shown to a company for
            a role you were matched or subscribed to, never browsable on its own.
          </p>

          <form action="/api/profile/future-interests" method="POST" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Roles or areas you'd consider</label>
              <input
                type="text"
                name="future_interests"
                defaultValue={profile?.future_interests?.join(', ') || ''}
                placeholder="e.g. VP Engineering, Fractional CFO, Head of Product"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-xs text-gray-500 mt-1">Separate with commas</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anything else worth knowing</label>
              <textarea
                name="future_interests_note"
                defaultValue={profile?.future_interests_note || ''}
                rows={3}
                placeholder="e.g. open to a Series B fintech role from mid-2027, prefer remote"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="flex items-center gap-2 px-6 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 font-medium">
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Roles you're future-interested in</h2>
          {subscriptions && subscriptions.length > 0 ? (
            <div className="divide-y">
              {subscriptions.map((s: any) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <span className="font-medium text-gray-900">{s.future_roles_public?.title ?? 'A role that has since closed'}</span>
                  {s.future_roles_public?.target_timeframe && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                      {s.future_roles_public.target_timeframe.replace('_', ' ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Nothing yet. <Link href="/roles" className="text-amber-700 hover:text-amber-800">Browse future roles</Link> to subscribe to one.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
