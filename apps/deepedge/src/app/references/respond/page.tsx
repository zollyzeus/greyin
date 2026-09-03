import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Building2, ArrowLeft, UserCheck } from 'lucide-react'
import Link from 'next/link'

const RELATIONSHIP_LABEL: Record<string, string> = {
  in_platform_task: 'Worked together on a Greyin project/gig',
  ex_colleague: 'Former colleague',
  current_colleague: 'Current colleague',
  other: 'Other professional relationship',
}

/**
 * Where a referee answers a reference request. Deliberately never shows
 * the candidate a link to check on responses here -- this page is
 * scoped to requests where the current user IS the named referee
 * (065_reference_checks.sql), and the response goes straight to the
 * requesting employer once submitted, never back through the candidate.
 */
export default async function RespondToReferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { success, error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/references/respond')
  }

  const { data: myAsReference } = await supabase
    .from('professional_references')
    .select('id, candidate_id, relationship_type, relationship_detail, profiles:candidate_id(full_name)')
    .eq('reference_user_id', user.id)

  const referenceById = new Map((myAsReference || []).map((r: any) => [r.id, r]))
  const referenceIds = [...referenceById.keys()]

  const { data: pendingRequests } = referenceIds.length
    ? await supabase
        .from('reference_requests')
        .select('id, reference_id, created_at, profiles:requested_by(full_name)')
        .in('reference_id', referenceIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://deepedge.greyin.net" className="flex items-center">
              <Building2 className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-2xl font-bold">DeepEdge</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/profile" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to profile
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-indigo-600" />
          Reference requests
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          These go straight to the employer who asked — the person you&rsquo;re a reference for never sees your answer.
        </p>

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Response submitted.
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        {pendingRequests && pendingRequests.length > 0 ? (
          <div className="space-y-6">
            {pendingRequests.map((req: any) => {
              const ref = referenceById.get(req.reference_id)
              return (
                <div key={req.id} className="bg-white rounded-lg shadow-md p-6">
                  <p className="text-sm text-gray-900 mb-1">
                    <strong>{req.profiles?.full_name || 'An employer'}</strong> asked you for a reference for{' '}
                    <strong>{ref?.profiles?.full_name || 'a candidate'}</strong>
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Your relationship on file: {RELATIONSHIP_LABEL[ref?.relationship_type] || ref?.relationship_type}
                    {ref?.relationship_detail && ` — ${ref.relationship_detail}`}
                  </p>
                  <form action="/api/references/respond" method="POST">
                    <input type="hidden" name="request_id" value={req.id} />
                    <textarea
                      name="body"
                      required
                      rows={4}
                      placeholder="What was it like working with them?"
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm mb-3"
                    />
                    <button type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold">
                      Submit response
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <UserCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No reference requests waiting on you right now.</p>
          </div>
        )}
      </div>
    </main>
  )
}
