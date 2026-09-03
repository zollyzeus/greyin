import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FlaskConical, ArrowLeft } from 'lucide-react'
import SkillRatingForm from '@/components/SkillRatingForm'

const APP_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-gray-100 text-gray-500',
}

const OUTCOME_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default async function AskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // No cron in this deployment -- catch up any outcome whose 14-day
  // review window lapsed with nobody reviewing it, lazily, right before
  // this page reads verified_outcomes.
  await supabase.rpc('finalize_expired_verified_outcomes')

  const { data: ask } = await supabase
    .from('project_asks')
    .select('*, builder_projects:project_id ( id, title, description, user_id )')
    .eq('id', id)
    .single()

  if (!ask) {
    notFound()
  }

  const project = ask.builder_projects
  const isOwner = user?.id === project?.user_id

  let myApplication: { id: string; status: string } | null = null
  let myOutcome: any = null
  let applications: any[] = []

  if (isOwner) {
    const { data } = await supabase
      .from('project_applications')
      .select('id, applicant_id, pitch, status, created_at, profiles:applicant_id ( full_name, seller_rating, total_reviews )')
      .eq('ask_id', id)
      .order('created_at', { ascending: true })
    applications = data || []

    const acceptedIds = applications.filter((a) => a.status === 'accepted').map((a) => a.id)
    if (acceptedIds.length > 0) {
      const { data: outcomes } = await supabase
        .from('verified_outcomes')
        .select('*')
        .in('application_id', acceptedIds)
      for (const app of applications) {
        app.outcome = outcomes?.find((o) => o.application_id === app.id) || null
      }
    }

    // Verified outcomes are readable by anyone once status='verified'
    // (030's RLS), so this is a straightforward public-record summary --
    // it exists to help the ask owner judge applicants by real track
    // record, not just their pitch text.
    const applicantIds = [...new Set(applications.map((a) => a.applicant_id))]
    if (applicantIds.length > 0) {
      const { data: trackRecord } = await supabase
        .from('verified_outcomes')
        .select('subject_user_id, score')
        .in('subject_user_id', applicantIds)
        .eq('status', 'verified')
      for (const app of applications) {
        const rows = trackRecord?.filter((r) => r.subject_user_id === app.applicant_id) || []
        app.trackRecord = rows.length > 0
          ? { count: rows.length, avgScore: Math.round(rows.reduce((sum, r) => sum + (r.score || 0), 0) / rows.length) }
          : null
      }

      // Salt & Pepper reputation, same cross-app read pattern as
      // above -- FlexPro's seller_rating/total_reviews already came
      // along on the profiles join, no extra query needed for that one.
      const { data: reputationRows } = await supabase
        .from('reputation_scores')
        .select('user_id, score')
        .in('user_id', applicantIds)
      for (const app of applications) {
        app.reputation = reputationRows?.find((r) => r.user_id === app.applicant_id)?.score || null
      }
    }
  } else if (user) {
    const { data } = await supabase
      .from('project_applications')
      .select('id, status')
      .eq('ask_id', id)
      .eq('applicant_id', user.id)
      .maybeSingle()
    myApplication = data

    if (myApplication?.status === 'accepted') {
      const { data: outcome } = await supabase
        .from('verified_outcomes')
        .select('*')
        .eq('application_id', myApplication.id)
        .maybeSingle()
      myOutcome = outcome
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <FlaskConical className="h-8 w-8 text-teal-600" />
              <span className="ml-2 text-2xl font-bold">StackWorks</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {project?.id ? (
          <Link href={`/projects/${project.id}`} className="flex items-center text-gray-600 hover:text-teal-600 mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {project.title}
          </Link>
        ) : (
          <Link href="/projects" className="flex items-center text-gray-600 hover:text-teal-600 mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to projects
          </Link>
        )}

        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{ask.role_title}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ask.status === 'open' ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
              {ask.status === 'open' ? 'Open' : 'Closed'}
            </span>
          </div>
          {ask.skills && ask.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {ask.skills.map((skill: string) => (
                <span key={skill} className="px-3 py-1 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium">
                  {skill}
                </span>
              ))}
            </div>
          )}
          {ask.description && <p className="text-gray-700 whitespace-pre-line mb-6">{ask.description}</p>}

          {isOwner && ask.status === 'open' && (
            <form action={`/api/asks/${id}/close`} method="POST" className="pt-4 border-t">
              <button type="submit" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
                Close this ask
              </button>
            </form>
          )}
        </div>

        {isOwner ? (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {applications.length} {applications.length === 1 ? 'Application' : 'Applications'}
            </h2>
            <div className="space-y-4">
              {applications.map((app) => (
                <div key={app.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                    <span className="font-semibold text-gray-900">{app.profiles?.full_name || 'Supporter'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${APP_STATUS_STYLES[app.status]}`}>
                      {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                    </span>
                  </div>
                  {(app.trackRecord || app.profiles?.total_reviews > 0 || app.reputation) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                      {app.trackRecord && (
                        <p className="text-xs text-teal-700 font-medium">
                          ✓ {app.trackRecord.count} verified outcome{app.trackRecord.count === 1 ? '' : 's'} · avg {app.trackRecord.avgScore}/100
                        </p>
                      )}
                      {app.profiles?.total_reviews > 0 && (
                        <p className="text-xs text-gray-600 font-medium">
                          ★ {app.profiles.seller_rating?.toFixed(1)} on FlexPro ({app.profiles.total_reviews})
                        </p>
                      )}
                      {app.reputation && (
                        <p className="text-xs text-gray-600 font-medium">
                          {app.reputation} reputation on Salt &amp; Pepper
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-gray-700 whitespace-pre-line mb-4">{app.pitch}</p>
                  {app.status === 'pending' && (
                    <div className="flex gap-3">
                      <form action={`/api/applications/${app.id}/respond`} method="POST">
                        <input type="hidden" name="decision" value="accepted" />
                        <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-semibold">
                          Accept
                        </button>
                      </form>
                      <form action={`/api/applications/${app.id}/respond`} method="POST">
                        <input type="hidden" name="decision" value="declined" />
                        <button type="submit" className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-semibold">
                          Decline
                        </button>
                      </form>
                    </div>
                  )}
                  {app.status === 'accepted' && !app.outcome && (
                    <p className="text-sm text-gray-500 border-t pt-4 mt-2">Waiting for their work to be submitted for verification.</p>
                  )}
                  {app.status === 'accepted' && app.outcome && (
                    <div className="border-t pt-4 mt-2">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">Submitted work</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${OUTCOME_STATUS_STYLES[app.outcome.status]}`}>
                          {app.outcome.status.charAt(0).toUpperCase() + app.outcome.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-line text-sm mb-2">{app.outcome.notes}</p>
                      {app.outcome.evidence_url && (
                        <a href={app.outcome.evidence_url} target="_blank" rel="noopener noreferrer" className="text-teal-600 text-sm hover:underline">
                          {app.outcome.evidence_url}
                        </a>
                      )}
                      <div className="bg-gray-50 rounded-lg p-3 mt-3 text-sm">
                        {app.outcome.ai_score !== null ? (
                          <>
                            <p className="font-semibold text-gray-900">AI review: {app.outcome.ai_score}/100</p>
                            {app.outcome.ai_notes && <p className="text-gray-600 mt-1">{app.outcome.ai_notes}</p>}
                          </>
                        ) : (
                          <p className="text-gray-500">AI review unavailable — awaiting manual review.</p>
                        )}
                      </div>
                      {app.outcome.human_score !== null && (
                        <div className="bg-gray-50 rounded-lg p-3 mt-2 text-sm">
                          <p className="font-semibold text-gray-900">Your review: {app.outcome.human_score}/100</p>
                          {app.outcome.human_notes && <p className="text-gray-600 mt-1">{app.outcome.human_notes}</p>}
                        </div>
                      )}
                      {app.outcome.status === 'pending' && (
                        <form action={`/api/verified-outcomes/${app.outcome.id}/human-review`} method="POST" className="mt-3 space-y-2">
                          <label htmlFor={`human_score-${app.outcome.id}`} className="block text-sm font-medium text-gray-700">
                            Your score (0-100)
                          </label>
                          <input
                            id={`human_score-${app.outcome.id}`}
                            name="human_score"
                            type="number"
                            min={0}
                            max={100}
                            required
                            className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                          />
                          <textarea
                            name="human_notes"
                            rows={2}
                            placeholder="Notes for the record (optional)"
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                          />
                          <button type="submit" className="bg-teal-600 text-white px-4 py-1.5 rounded-lg hover:bg-teal-700 text-sm font-semibold">
                            Submit review
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                  {app.status !== 'declined' && ask.skills && ask.skills.length > 0 && (
                    <SkillRatingForm applicationId={app.id} rateeId={app.applicant_id} skills={ask.skills} />
                  )}
                </div>
              ))}
              {applications.length === 0 && (
                <p className="text-gray-500 text-sm bg-white rounded-lg shadow p-4">No applications yet.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            {!user ? (
              <p className="text-gray-600">
                <Link href={`/login?next=/asks/${id}`} className="text-teal-600 hover:text-teal-700 font-semibold">
                  Sign in
                </Link>{' '}
                to apply.
              </p>
            ) : myApplication ? (
              <div>
                <p className="text-gray-700 mb-4">
                  You applied to this ask —{' '}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${APP_STATUS_STYLES[myApplication.status]}`}>
                    {myApplication.status.charAt(0).toUpperCase() + myApplication.status.slice(1)}
                  </span>
                </p>
                {myApplication.status === 'accepted' && !myOutcome && (
                  <form action={`/api/applications/${myApplication.id}/submit-outcome`} method="POST" className="border-t pt-4 space-y-3">
                    <h3 className="font-semibold text-gray-900">Submit your work for verification</h3>
                    <div>
                      <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">What did you deliver?</label>
                      <textarea
                        id="summary"
                        name="summary"
                        required
                        rows={4}
                        placeholder="Describe what you built and how it satisfies the ask..."
                        className="w-full border border-gray-300 rounded-lg p-3"
                      />
                    </div>
                    <div>
                      <label htmlFor="evidence_url" className="block text-sm font-medium text-gray-700 mb-1">Evidence link (optional)</label>
                      <input
                        id="evidence_url"
                        name="evidence_url"
                        type="url"
                        placeholder="Link to a PR, deployed demo, repo, etc."
                        className="w-full border border-gray-300 rounded-lg p-2"
                      />
                    </div>
                    <button type="submit" className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 font-semibold">
                      Submit for verification
                    </button>
                  </form>
                )}
                {myOutcome && (
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">Your submission</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${OUTCOME_STATUS_STYLES[myOutcome.status]}`}>
                        {myOutcome.status.charAt(0).toUpperCase() + myOutcome.status.slice(1)}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                      {myOutcome.ai_score !== null ? (
                        <>
                          <p className="font-semibold text-gray-900">AI review: {myOutcome.ai_score}/100</p>
                          {myOutcome.ai_notes && <p className="text-gray-600 mt-1">{myOutcome.ai_notes}</p>}
                        </>
                      ) : (
                        <p className="text-gray-500">AI review unavailable — awaiting manual review.</p>
                      )}
                    </div>
                    {myOutcome.human_score !== null && (
                      <div className="bg-gray-50 rounded-lg p-3 mt-2 text-sm">
                        <p className="font-semibold text-gray-900">Reviewer score: {myOutcome.human_score}/100</p>
                        {myOutcome.human_notes && <p className="text-gray-600 mt-1">{myOutcome.human_notes}</p>}
                      </div>
                    )}
                  </div>
                )}
                {myApplication.status !== 'declined' && project?.user_id && ask.skills && ask.skills.length > 0 && (
                  <SkillRatingForm applicationId={myApplication.id} rateeId={project.user_id} skills={ask.skills} />
                )}
              </div>
            ) : ask.status !== 'open' ? (
              <p className="text-gray-600">This ask is closed.</p>
            ) : (
              <form action={`/api/asks/${id}/apply`} method="POST">
                <label htmlFor="pitch" className="block text-sm font-medium text-gray-700 mb-1">Your pitch</label>
                <textarea
                  id="pitch"
                  name="pitch"
                  required
                  rows={4}
                  placeholder="Why you, and how you'd approach this..."
                  className="w-full border border-gray-300 rounded-lg p-4 mb-4"
                />
                <button type="submit" className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 font-semibold">
                  Apply
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
