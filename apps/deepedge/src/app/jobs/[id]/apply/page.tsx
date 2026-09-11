import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { CoverLetterAssist } from '@/components/CoverLetterAssist'

interface ApplyPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function ApplyPage({ params, searchParams }: ApplyPageProps) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=/jobs/${id}/apply`)
  }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, description, companies ( name )')
    .eq('id', id)
    .single()

  if (!job) {
    notFound()
  }

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, resume_url')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: existingApplication } = candidate
    ? await supabase
        .from('applications')
        .select('id, status')
        .eq('job_id', id)
        .eq('candidate_id', candidate.id)
        .maybeSingle()
    : { data: null }

  return (
    <WorkspaceShell
      activeSection="jobs"
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Apply"
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href={`/jobs/${id}`} className="flex items-center text-gray-600 hover:text-blue-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to job
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 mb-1 dark:text-gray-50">
            Apply for {job.title}
          </h1>
          <p className="text-gray-600 mb-6 dark:text-gray-400">
            at {(job.companies as unknown as { name: string } | null)?.name || 'this company'}
          </p>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
              {decodeURIComponent(error)}
            </div>
          )}

          {existingApplication ? (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-400">
              You already applied to this job. Current status:{' '}
              <span className="font-semibold capitalize">{existingApplication.status}</span>.{' '}
              <Link href="/dashboard/applications" className="underline">
                View your applications
              </Link>
            </div>
          ) : (
            <form action="/api/applications/create" method="POST" className="space-y-6">
              <input type="hidden" name="job_id" value={id} />

              <div>
                <label htmlFor="cover_letter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Cover letter
                </label>
                <textarea
                  id="cover_letter"
                  name="cover_letter"
                  rows={6}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Tell them why you're a great fit..."
                />
                <CoverLetterAssist
                  jobTitle={job.title}
                  jobDescription={job.description}
                  companyName={(job.companies as unknown as { name: string } | null)?.name ?? null}
                />
              </div>

              <div>
                <label htmlFor="resume_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Resume URL
                </label>
                <input
                  id="resume_url"
                  name="resume_url"
                  type="url"
                  defaultValue={candidate?.resume_url || ''}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="https://..."
                />
                {candidate?.resume_url && (
                  <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Pre-filled from your profile — edit if this role needs a different resume.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="expected_salary" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Expected salary
                  </label>
                  <input
                    id="expected_salary"
                    name="expected_salary"
                    type="number"
                    min={0}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    placeholder="120000"
                  />
                </div>

                <div>
                  <label htmlFor="available_from" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Available from
                  </label>
                  <input
                    id="available_from"
                    name="available_from"
                    type="date"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
              >
                Submit Application
              </button>
            </form>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
