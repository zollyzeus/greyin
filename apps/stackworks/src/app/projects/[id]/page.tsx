import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FlaskConical, ArrowLeft, Github, ExternalLink, Heart, PlusCircle, ClipboardList, BadgeCheck } from 'lucide-react'
import { FollowButton } from '@/components/FollowButton'
import { ThemeToggle } from '@/components/ThemeToggle'

const ASK_STATUS_STYLES: Record<string, string> = {
  open: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400',
  closed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  await supabase.rpc('finalize_expired_verified_outcomes')

  const { data: project } = await supabase
    .from('builder_projects')
    .select('*, profiles:user_id ( full_name )')
    .eq('id', id)
    .single()

  if (!project) {
    notFound()
  }

  const isOwner = user?.id === project.user_id

  // RLS lets the owner see their own outcome regardless of status, and
  // everyone else see it once status='verified' -- so this single query
  // both drives the owner's submit/pending UI and the public "Verified
  // shipped" badge without needing a second, gated query.
  const { data: shippedOutcome } = await supabase
    .from('verified_outcomes')
    .select('id, status, score, ai_score, ai_notes')
    .eq('project_id', id)
    .eq('outcome_type', 'project_shipped')
    .maybeSingle()

  let hasUpvoted = false
  if (user) {
    const { data: upvote } = await supabase
      .from('project_upvotes')
      .select('project_id')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    hasUpvoted = !!upvote
  }

  const { data: asks } = await supabase
    .from('project_asks')
    .select('id, role_title, skills, status')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  const { data: updates } = await supabase
    .from('project_updates')
    .select('id, body, created_at, profiles:author_id ( full_name )')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  const { data: myFollow } = user && project.user_id
    ? await supabase.from('user_follows').select('followed_id').eq('follower_id', user.id).eq('followed_id', project.user_id).maybeSingle()
    : { data: null }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <FlaskConical className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              <span className="ml-2 text-2xl font-bold">StackWorks</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/projects" className="flex items-center text-gray-600 hover:text-teal-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8 mb-6 dark:bg-gray-900">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">{project.title}</h1>
            {shippedOutcome?.status === 'verified' && (
              <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold dark:bg-green-950/40 dark:text-green-400">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified shipped{shippedOutcome.score !== null ? ` · ${shippedOutcome.score}/100` : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-6 dark:text-gray-400">
            by {project.profiles?.full_name || 'Builder'} • {new Date(project.created_at).toLocaleDateString()}
          </p>

          {user && !isOwner && project.user_id && (
            <FollowButton
              targetUserId={project.user_id}
              isFollowing={!!myFollow}
              next={`/projects/${id}`}
            />
          )}

          {project.images && project.images.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-6">
              {project.images.map((url: string) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="" className="w-40 h-28 object-cover rounded-lg border border-gray-200 dark:border-gray-800" />
              ))}
            </div>
          )}

          <p className="text-gray-700 whitespace-pre-line mb-6 dark:text-gray-300">{project.description}</p>

          {project.tech_stack && project.tech_stack.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {project.tech_stack.map((tech: string) => (
                <span key={tech} className="px-3 py-1 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium dark:bg-teal-950/40 dark:text-teal-400">
                  {tech}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-6 border-t">
            <div className="flex items-center gap-4">
              {project.github_url && (
                <a href={project.github_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-700 hover:text-teal-600 text-sm font-semibold dark:text-gray-300">
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
              )}
              {project.demo_url && (
                <a href={project.demo_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-700 hover:text-teal-600 text-sm font-semibold dark:text-gray-300">
                  <ExternalLink className="h-4 w-4" />
                  Live Demo
                </a>
              )}
            </div>

            {user ? (
              <form action={`/api/projects/${id}/upvote`} method="POST">
                <button
                  type="submit"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm ${
                    hasUpvoted ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-400'
                  }`}
                >
                  <Heart className="h-4 w-4" fill={hasUpvoted ? 'currentColor' : 'none'} />
                  {project.upvote_count || 0}
                </button>
              </form>
            ) : (
              <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                <Heart className="h-4 w-4" />
                {project.upvote_count || 0}
              </span>
            )}
          </div>
        </div>

        {isOwner && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2 dark:text-gray-50">
              <BadgeCheck className="h-5 w-5" />
              Verification
            </h2>
            {!shippedOutcome ? (
              <form action={`/api/projects/${id}/submit-outcome`} method="POST" className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">Submit this project for verification to earn a Verified badge on it.</p>
                <div>
                  <label htmlFor="ship-summary" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">What did you ship?</label>
                  <textarea
                    id="ship-summary"
                    name="summary"
                    required
                    rows={3}
                    placeholder="Describe what's complete and working..."
                    className="w-full border border-gray-300 rounded-lg p-3 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label htmlFor="ship-evidence" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Evidence link (optional)</label>
                  <input
                    id="ship-evidence"
                    name="evidence_url"
                    type="url"
                    placeholder="Repo, deployed demo, etc."
                    className="w-full border border-gray-300 rounded-lg p-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
                <button type="submit" className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 font-semibold">
                  Submit for verification
                </button>
              </form>
            ) : shippedOutcome.status === 'pending' ? (
              <div className="text-sm">
                <p className="text-gray-700 mb-2 dark:text-gray-300">Submitted — awaiting review.</p>
                {shippedOutcome.ai_score !== null ? (
                  <p className="text-gray-600 dark:text-gray-400">AI review: {shippedOutcome.ai_score}/100{shippedOutcome.ai_notes ? ` — ${shippedOutcome.ai_notes}` : ''}</p>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">AI review unavailable — an admin will review this manually.</p>
                )}
              </div>
            ) : shippedOutcome.status === 'rejected' ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">This submission wasn&apos;t verified. Contact an admin if you think that&apos;s wrong.</p>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">Verified — {shippedOutcome.score}/100.</p>
            )}
          </div>
        )}

        {/* Asks */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 dark:text-gray-50">
              <ClipboardList className="h-5 w-5" />
              Open Asks
            </h2>
            {isOwner && (
              <Link
                href={`/projects/${id}/asks/new`}
                className="flex items-center gap-1 text-sm font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
              >
                <PlusCircle className="h-4 w-4" />
                Post an ask
              </Link>
            )}
          </div>
          {asks && asks.length > 0 ? (
            <div className="space-y-3">
              {asks.map((ask: any) => (
                <Link
                  key={ask.id}
                  href={`/asks/${ask.id}`}
                  className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition dark:bg-gray-900"
                >
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-gray-50">{ask.role_title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ASK_STATUS_STYLES[ask.status] || ASK_STATUS_STYLES.open}`}>
                      {ask.status === 'open' ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  {ask.skills && ask.skills.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{ask.skills.join(', ')}</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm bg-white rounded-lg shadow p-4 dark:text-gray-400 dark:bg-gray-900">No open asks yet.</p>
          )}
        </div>

        {/* Updates */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 dark:text-gray-50">Updates</h2>

          {isOwner && (
            <div className="bg-white rounded-lg shadow p-6 mb-4 dark:bg-gray-900">
              <form action={`/api/projects/${id}/updates/create`} method="POST">
                <textarea
                  name="body"
                  required
                  rows={3}
                  placeholder="Post a devlog-style update..."
                  className="w-full border border-gray-300 rounded-lg p-4 mb-4 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <div className="mb-4">
                  <label htmlFor="feed_visibility" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Show in followers&rsquo; feed</label>
                  <select id="feed_visibility" name="feed_visibility" defaultValue="public"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                    <option value="public">Public</option>
                    <option value="followers">Followers only</option>
                    <option value="private">Don&rsquo;t include</option>
                  </select>
                </div>
                <button type="submit" className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 font-semibold">
                  Post Update
                </button>
              </form>
            </div>
          )}

          <div className="space-y-4">
            {updates?.map((update: any) => (
              <div key={update.id} className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-50">{update.profiles?.full_name || 'Builder'}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(update.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-gray-700 whitespace-pre-line dark:text-gray-300">{update.body}</p>
              </div>
            ))}
            {(!updates || updates.length === 0) && (
              <p className="text-gray-500 text-sm bg-white rounded-lg shadow p-4 dark:text-gray-400 dark:bg-gray-900">No updates yet.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
