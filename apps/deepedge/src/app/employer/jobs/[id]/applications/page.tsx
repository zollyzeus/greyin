import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, FileText, MessageCircle, BadgeCheck, Shuffle, RotateCcw } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

const STATUSES = [
  'submitted', 'reviewing', 'shortlisted', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn',
]

export default async function JobApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { id: jobId } = await params
  const { success, error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/employer/jobs/${jobId}/applications`)
  }

  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, company_id, companies ( user_id, name )')
    .eq('id', jobId)
    .single()

  if (!job) {
    notFound()
  }

  if ((job.companies as any)?.user_id !== user.id) {
    redirect('/employer/dashboard')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: applications } = await supabase
    .from('applications')
    .select('id, status, cover_letter, resume_url, expected_salary, available_from, applied_at, candidates ( id, user_id, current_title, experience_years, skills, resume_url, profiles ( full_name, email, is_pivoter, pivot_from_domain, pivot_to_domain, pivot_note, is_reentry, reentry_reason, reentry_note ) )')
    .eq('job_id', jobId)
    .order('applied_at', { ascending: false })

  // StackWorks verified track record, cross-referenced by candidate user id
  // -- turns a self-reported resume into something with real proof
  // behind it. Cross-app read, same pattern stackworks already uses against
  // saltnpepper's builder_projects.
  const candidateIds = [...new Set((applications || []).map((a: any) => a.candidates?.user_id).filter(Boolean))]
  const { data: verifiedOutcomes } = candidateIds.length
    ? await supabase.from('verified_outcomes').select('subject_user_id, score').in('subject_user_id', candidateIds).eq('status', 'verified')
    : { data: [] }
  const trackRecordByUser = new Map<string, { count: number; avgScore: number }>()
  for (const id of candidateIds) {
    const rows = (verifiedOutcomes || []).filter((o) => o.subject_user_id === id)
    if (rows.length > 0) {
      trackRecordByUser.set(id, { count: rows.length, avgScore: Math.round(rows.reduce((s, r) => s + (r.score || 0), 0) / rows.length) })
    }
  }

  // The consolidated cross-pillar Greyin Score is the primary signal shown
  // to employers here -- the StackWorks line above is one input into it, kept
  // as supporting detail rather than replaced.
  const { data: scoreRows } = candidateIds.length
    ? await supabase.from('greyin_scores').select('user_id, greyin_score, is_verified_expert').in('user_id', candidateIds)
    : { data: [] }
  const scoreByUser = new Map((scoreRows || []).map((r) => [r.user_id, r]))

  return (
    <WorkspaceShell
      variant="employer"
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Applications"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/employer/dashboard" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-1 dark:text-gray-50">Applications</h1>
        <p className="text-gray-600 mb-6 dark:text-gray-400">for {job.title}</p>

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            Application status updated.
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {decodeURIComponent(error)}
          </div>
        )}

        {applications && applications.length > 0 ? (
          <div className="space-y-4">
            {applications.map((app: any) => (
              <div key={app.id} className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-50">
                      {app.candidates?.profiles?.full_name || 'Candidate'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {app.candidates?.current_title || 'No title provided'}
                      {app.candidates?.experience_years ? ` • ${app.candidates.experience_years} yrs experience` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">
                      Applied {new Date(app.applied_at).toLocaleDateString()}
                    </p>
                    {scoreByUser.get(app.candidates?.user_id) && (
                      <p className="flex items-center gap-1 text-xs text-indigo-700 font-semibold mt-1 dark:text-indigo-400">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Greyin Score {scoreByUser.get(app.candidates.user_id)!.greyin_score}
                        {scoreByUser.get(app.candidates.user_id)!.is_verified_expert ? ' · Verified Expert' : ''}
                      </p>
                    )}
                    {app.candidates?.profiles?.is_pivoter && (
                      <p className="flex items-center gap-1 text-xs text-orange-700 font-semibold mt-1 dark:text-orange-400">
                        <Shuffle className="h-3.5 w-3.5" />
                        Career Changer: {app.candidates.profiles.pivot_from_domain || '—'} → {app.candidates.profiles.pivot_to_domain || '—'}
                        {app.candidates.profiles.pivot_note ? ` — "${app.candidates.profiles.pivot_note}"` : ''}
                      </p>
                    )}
                    {app.candidates?.profiles?.is_reentry && (
                      <p className="flex items-center gap-1 text-xs text-blue-700 font-semibold mt-1 dark:text-blue-400">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Returning to work{app.candidates.profiles.reentry_reason ? ` · ${app.candidates.profiles.reentry_reason}` : ''}
                        {app.candidates.profiles.reentry_note ? ` — "${app.candidates.profiles.reentry_note}"` : ''}
                      </p>
                    )}
                    {trackRecordByUser.get(app.candidates?.user_id) && (
                      <p className="flex items-center gap-1 text-xs text-green-700 font-medium mt-1 dark:text-green-400">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {trackRecordByUser.get(app.candidates.user_id)!.count} verified outcome{trackRecordByUser.get(app.candidates.user_id)!.count === 1 ? '' : 's'} on StackWorks · avg {trackRecordByUser.get(app.candidates.user_id)!.avgScore}/100
                      </p>
                    )}
                  </div>
                  <form action={`/api/applications/${app.id}/status`} method="POST" className="flex items-center gap-2">
                    <input type="hidden" name="job_id" value={jobId} />
                    <select
                      name="status"
                      defaultValue={app.status}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 capitalize dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Update
                    </button>
                  </form>
                </div>

                {app.cover_letter && (
                  <p className="mt-4 text-sm text-gray-700 whitespace-pre-line border-t pt-4 dark:text-gray-300">
                    {app.cover_letter}
                  </p>
                )}

                <div className="mt-4 flex gap-4 text-sm">
                  {app.resume_url && (
                    <a href={app.resume_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                      View Resume
                    </a>
                  )}
                  {app.expected_salary && (
                    <span className="text-gray-500 dark:text-gray-400">Expects ${app.expected_salary.toLocaleString()}</span>
                  )}
                  {app.candidates?.user_id && (
                    <form action="/api/messages/start" method="POST">
                      <input type="hidden" name="other_user_id" value={app.candidates.user_id} />
                      <button type="submit" className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                        <MessageCircle className="h-4 w-4" />
                        Message candidate
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center dark:bg-gray-900">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4 dark:text-gray-500" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-50">No applications yet</h3>
          </div>
        )}
      </div>
    </WorkspaceShell>
  )
}
