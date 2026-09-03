import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { ArrowLeft, Briefcase } from 'lucide-react'

/**
 * The moderation surface flagged as missing in the original feature
 * assessment (089/090/091_peer_project*.sql): RLS admin-DELETE
 * policies existed from the start, but nothing let an admin actually
 * browse for what needs deleting without raw SQL. Flagged projects
 * (peer_project_reciprocity_flags, 091 -- a mutual pair where both
 * sides rated each other 4+) surface first, since that's the actual
 * triage question a moderator has when they land here.
 */
export default async function PeerProjectsAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/peer-projects')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const [{ data: projects }, { data: flagRows }] = await Promise.all([
    supabase
      .from('peer_projects')
      .select('id, title, company, created_at, creator_id, profiles:creator_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(50),
    // Admin is one of the two roles peer_project_reciprocity_flags'
    // own gate allows -- same query any employer would run, just for
    // every project rather than one candidate's.
    supabase.from('peer_project_reciprocity_flags').select('project_id'),
  ])

  const flaggedProjectIds = new Set((flagRows || []).map((r) => r.project_id))
  const sorted = [...(projects || [])].sort((a, b) => {
    const aFlagged = flaggedProjectIds.has(a.id) ? 1 : 0
    const bFlagged = flaggedProjectIds.has(b.id) ? 1 : 0
    return bFlagged - aFlagged
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to admin
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <Briefcase className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Peer-Confirmed Projects</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Most recent 50 projects, flagged ones first. Deleting a project removes its members and ratings with it.
        </p>

        {sorted.length > 0 ? (
          <div className="space-y-3">
            {sorted.map((p: any) => {
              const flagged = flaggedProjectIds.has(p.id)
              return (
                <div key={p.id} className={`bg-white rounded-lg shadow-sm border p-4 flex items-center justify-between ${flagged ? 'border-amber-300' : 'border-gray-200'}`}>
                  <div>
                    <p className="font-medium text-gray-900">
                      {p.title}
                      {flagged && (
                        <span className="ml-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                          ⚠ Possible reciprocal rating
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      {p.company} · added by {p.profiles?.full_name || 'Unknown'} · {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <form action="/api/admin/peer-projects/delete" method="POST">
                    <input type="hidden" name="project_id" value={p.id} />
                    <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 flex-shrink-0 ml-4">
                      Delete
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No peer-confirmed projects yet.</p>
        )}
      </div>
    </main>
  )
}
