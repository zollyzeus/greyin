import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users, ArrowLeft, Briefcase, BadgeCheck, Lock, RotateCcw, Send } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; min_experience?: string; availability?: string; remote_preference?: string; min_score?: string; invited?: string; invite_error?: string }>
}) {
  const { skill, min_experience, availability, remote_preference, min_score, invited, invite_error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/candidates')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'employer') {
    redirect('/dashboard')
  }

  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  // Proactive candidate search is the toll gate -- posting jobs, browsing
  // jobs, and reviewing applicants to your own postings all stay free
  // (see migration 039's banner comment for why: gating those would
  // strangle the open-board liquidity the hybrid gate decision, 038, was
  // built to preserve). Only this page is behind a subscription.
  const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).maybeSingle()
  const { data: subscription } = company
    ? await supabase
        .from('company_subscriptions')
        .select('status, current_period_end')
        .eq('company_id', company.id)
        .maybeSingle()
    : { data: null }
  const hasActiveSubscription = !!subscription
    && subscription.status === 'active'
    && (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date())

  if (!hasActiveSubscription) {
    return (
      <WorkspaceShell
        variant="employer"
        activeSection="candidates"
        userName={profile?.full_name || 'User'}
        verified={!!scoreRow?.is_verified_expert}
        greyinScore={scoreRow?.greyin_score ?? null}
        pageTitle="Find Talent"
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="bg-white rounded-2xl shadow-md p-10 dark:bg-gray-900">
            <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-indigo-950/40">
              <Lock className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 dark:text-gray-50">Subscribe to search the Verified Expert pool</h1>
            <p className="text-gray-600 mb-8 dark:text-gray-400">
              Reviewing applicants to your own job postings is always free. Proactively browsing every
              Verified Expert candidate requires a subscription.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/subscribe" className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700">
                Subscribe (Starter)
              </Link>
              <Link href="/pricing" className="border-2 border-indigo-600 text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40">
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </WorkspaceShell>
    )
  }

  // Employers only ever see the Verified Expert pool -- the literal
  // implementation of "b2b clients hire only 12+ experienced folks."
  // Pivoters are deliberately excluded here -- a 15-year finance veteran
  // pivoting into engineering shouldn't surface in a generic "senior
  // engineers" search just because their years/score qualify; they're
  // matched instead through jobs explicitly opened to career changers
  // (see api/applications/create).
  //
  // This used to be two client-side queries -- fetch every verified-expert
  // user_id, then `.in('user_id', <that list>)` against candidates -- but
  // supabase-js sends `.in()` as a GET query string, so the id list lands
  // directly in the request URL. Past a few hundred verified experts that
  // URL exceeds PostgREST's request-line limit and the whole page silently
  // renders "No candidates found" (confirmed live: 243 verified experts
  // produced a 9.1KB URL and a 414). search_verified_candidates (migration
  // 107) does the same join server-side instead, under the caller's own
  // RLS exactly as the old query ran under it -- no id list ever reaches
  // a URL, so this scales past any real headcount.
  const { data: candidateRows } = await supabase.rpc('search_verified_candidates', {
    p_skill: skill || null,
    p_min_experience: min_experience ? parseInt(min_experience, 10) : null,
    p_availability: availability || null,
    p_remote_preference: remote_preference || null,
    p_min_score: min_score ? parseInt(min_score, 10) : null,
  })

  // For the "Invite to job" action below -- an employer can only invite
  // to one of their own OPEN postings, same ownership boundary
  // job_invites' own RLS enforces server-side (149).
  const { data: ownOpenJobs } = company
    ? await supabase.from('jobs').select('id, title').eq('company_id', company.id).eq('status', 'open').order('created_at', { ascending: false })
    : { data: [] }

  const scoreByUserId = new Map((candidateRows || []).map((r: any) => [r.user_id, r.greyin_score]))
  const candidates = (candidateRows || []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    current_title: r.current_title,
    skills: r.skills,
    experience_years: r.experience_years,
    availability: r.availability,
    remote_preference: r.remote_preference,
    profiles: {
      full_name: r.full_name,
      location: r.location,
      avatar_url: r.avatar_url,
      is_reentry: r.is_reentry,
      reentry_reason: r.reentry_reason,
    },
  }))

  return (
    <WorkspaceShell
      variant="employer"
      activeSection="candidates"
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Find Talent"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/employer/dashboard" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-6 dark:text-gray-50">Browse Candidates</h1>

        {invited && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            Invite sent.
          </div>
        )}
        {invite_error && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-400">
            {invite_error}
          </div>
        )}

        <form className="mb-6 flex flex-wrap gap-3">
          <input
            type="text"
            name="skill"
            defaultValue={skill || ''}
            placeholder="Filter by skill (e.g. Rust)"
            className="flex-1 min-w-[12rem] border border-gray-300 rounded-lg px-4 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
          <select
            name="min_experience"
            defaultValue={min_experience || ''}
            className="border border-gray-300 rounded-lg px-4 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          >
            <option value="">Any experience</option>
            <option value="5">5+ years</option>
            <option value="10">10+ years</option>
            <option value="15">15+ years</option>
            <option value="20">20+ years</option>
          </select>
          <select
            name="availability"
            defaultValue={availability || ''}
            className="border border-gray-300 rounded-lg px-4 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          >
            <option value="">Any availability</option>
            <option value="immediate">Immediate</option>
            <option value="2weeks">2 weeks notice</option>
            <option value="1month">1 month notice</option>
            <option value="not_available">Not available</option>
          </select>
          <select
            name="remote_preference"
            defaultValue={remote_preference || ''}
            className="border border-gray-300 rounded-lg px-4 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          >
            <option value="">Any location preference</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
            <option value="flexible">Flexible</option>
          </select>
          <select
            name="min_score"
            defaultValue={min_score || ''}
            className="border border-gray-300 rounded-lg px-4 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          >
            <option value="">Any Greyin Score</option>
            <option value="60">60+</option>
            <option value="75">75+</option>
            <option value="85">85+</option>
          </select>
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-semibold">
            Search
          </button>
        </form>
        <p className="text-xs text-gray-500 mb-4 -mt-3 dark:text-gray-400">Results are ranked by Greyin Score, highest first.</p>

        {candidates && candidates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {candidates.map((candidate: any) => (
              <div key={candidate.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow dark:bg-gray-900">
              <Link href={`/candidates/${candidate.user_id}`} className="block">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center dark:bg-gray-800">
                    <Users className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-50">{candidate.profiles?.full_name || 'Candidate'}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{candidate.current_title || 'No title provided'}</p>
                  </div>
                </div>

                <p className="flex items-center gap-1 text-xs font-semibold text-indigo-700 mb-3 dark:text-indigo-400">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified Expert{scoreByUserId.get(candidate.user_id) != null ? ` · Greyin Score ${scoreByUserId.get(candidate.user_id)}` : ''}
                </p>

                {candidate.profiles?.is_reentry && (
                  <p className="flex items-center gap-1 text-xs font-medium text-blue-700 mb-3 dark:text-blue-400">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Returning to work{candidate.profiles.reentry_reason ? ` · ${candidate.profiles.reentry_reason}` : ''}
                  </p>
                )}

                <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-3 dark:text-gray-400">
                  {candidate.experience_years != null && <span>{candidate.experience_years} yrs experience</span>}
                  {candidate.availability && <span className="capitalize">{candidate.availability.replace('_', ' ')}</span>}
                  {candidate.remote_preference && <span className="capitalize">{candidate.remote_preference}</span>}
                </div>

                {candidate.skills && candidate.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.slice(0, 6).map((s: string) => (
                      <span key={s} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium dark:bg-indigo-950/40 dark:text-indigo-400">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </Link>

              {ownOpenJobs && ownOpenJobs.length > 0 && (
                <form action={`/api/candidates/${candidate.user_id}/invite`} method="POST" className="mt-4 pt-4 border-t border-gray-100 flex gap-2 dark:border-gray-800">
                  <select
                    name="job_id"
                    required
                    className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  >
                    {ownOpenJobs.map((j: any) => (
                      <option key={j.id} value={j.id}>{j.title}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="shrink-0 flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
                  >
                    <Send className="h-3 w-3" />
                    Invite
                  </button>
                </form>
              )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center dark:bg-gray-900">
            <Briefcase className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2 dark:text-gray-50">No candidates found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try a different skill filter</p>
          </div>
        )}
      </div>
    </WorkspaceShell>
  )
}
