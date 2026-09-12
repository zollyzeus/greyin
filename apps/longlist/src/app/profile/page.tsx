import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Compass, Save, Scale } from 'lucide-react'
import Link from 'next/link'
import { EcosystemWidget } from '@/components/EcosystemWidget'
import { WorkspaceShell } from '@/components/WorkspaceShell'

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
    .select('full_name, role, future_interests, future_interests_note')
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

  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()
  const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).maybeSingle()
  const { data: demographics } = await supabase
    .from('profile_demographics')
    .select('gender, gender_self_description, age_range, disability_status')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <WorkspaceShell
      activeSection="profile"
      hasCompany={!!company}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      role={profile?.role}
      pageTitle="Your Future Interests"
    >
      <div className="max-w-3xl mx-auto px-4 py-8">
        <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />

        <div className="bg-white rounded-lg shadow p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            Where you're headed
          </h2>
          <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
            Optional. This is the signal AI matching uses to surface you to a company&rsquo;s posted future
            role even if you never subscribed to it yourself — your name is only ever shown to a company for
            a role you were matched or subscribed to, never browsable on its own.
          </p>

          <form action="/api/profile/future-interests" method="POST" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Roles or areas you'd consider</label>
              <input
                type="text"
                name="future_interests"
                defaultValue={profile?.future_interests?.join(', ') || ''}
                placeholder="e.g. VP Engineering, Fractional CFO, Head of Product"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Separate with commas</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Anything else worth knowing</label>
              <textarea
                name="future_interests_note"
                defaultValue={profile?.future_interests_note || ''}
                rows={3}
                placeholder="e.g. open to a Series B fintech role from mid-2027, prefer remote"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
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

        <div className="bg-white rounded-lg shadow p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            Optional demographic self-ID
          </h2>
          <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
            Entirely optional and never required. Used only in aggregate, to check that Longlist&rsquo;s AI-surfaced
            matching isn&rsquo;t skewing against any group — never shown to companies, never used as a matching
            input, and never viewable by anyone as your individual answer. &ldquo;Prefer not to say&rdquo; is always
            a valid choice.
          </p>

          <form action="/api/profile/demographics" method="POST" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Gender</label>
              <select
                name="gender"
                defaultValue={demographics?.gender || 'prefer_not_to_say'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                <option value="woman">Woman</option>
                <option value="man">Man</option>
                <option value="non_binary">Non-binary</option>
                <option value="self_describe">Prefer to self-describe</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <input
                type="text"
                name="gender_self_description"
                defaultValue={demographics?.gender_self_description || ''}
                placeholder="Self-description (only used if you chose that above)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Age range</label>
              <select
                name="age_range"
                defaultValue={demographics?.age_range || 'prefer_not_to_say'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                <option value="under_25">Under 25</option>
                <option value="25_34">25–34</option>
                <option value="35_44">35–44</option>
                <option value="45_54">45–54</option>
                <option value="55_64">55–64</option>
                <option value="65_plus">65+</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Do you identify as having a disability?</label>
              <select
                name="disability_status"
                defaultValue={demographics?.disability_status || 'prefer_not_to_say'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="flex items-center gap-2 px-6 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 font-medium">
                <Save className="w-4 h-4" />
                Update demographics
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Roles you're future-interested in</h2>
          {subscriptions && subscriptions.length > 0 ? (
            <div className="divide-y">
              {subscriptions.map((s: any) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-50">{s.future_roles_public?.title ?? 'A role that has since closed'}</span>
                  {s.future_roles_public?.target_timeframe && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold dark:bg-amber-950/40 dark:text-amber-400">
                      {s.future_roles_public.target_timeframe.replace('_', ' ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nothing yet. <Link href="/roles" className="text-amber-700 hover:text-amber-800 dark:text-amber-400">Browse future roles</Link> to subscribe to one.
            </p>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
