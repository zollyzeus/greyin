import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { MessageThread } from '@/components/MessageThread'
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton'

export default async function MessageThreadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reported?: string; report_error?: string }> }) {
  const { id } = await params
  const { reported, report_error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/messages/${id}`)
  }

  const { data: viewerProfile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: viewerScoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  // RLS already scopes this to conversations the user participates in — an
  // empty result here means either it doesn't exist or they're not in it,
  // and either way a 404 is the right response.
  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('user_id, profiles ( id, full_name )')
    .eq('conversation_id', id)

  if (!participants || participants.length === 0) {
    notFound()
  }

  const other = (participants as any[]).find((p) => p.user_id !== user.id)?.profiles

  const { data: messages } = await supabase
    .from('direct_messages')
    .select('id, sender_id, body, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  // Mark the other person's messages read now that this user has viewed them.
  await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', id)
    .neq('sender_id', user.id)
    .is('read_at', null)

  return (
    <WorkspaceShell
      activeSection="messages"
      isAdmin={viewerProfile?.role === 'admin'}
      userName={viewerProfile?.full_name || 'User'}
      verified={!!viewerScoreRow?.is_verified_expert}
      greyinScore={viewerScoreRow?.greyin_score ?? null}
      pageTitle={other?.full_name || 'Conversation'}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {reported && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            Report submitted -- an admin will review it.
          </div>
        )}
        {report_error && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-400">
            {report_error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">{other?.full_name || 'Conversation'}</h1>
          {other && (
            <div className="flex items-center gap-3 shrink-0">
              <details className="relative">
                <summary className="text-xs text-gray-400 hover:text-red-600 cursor-pointer select-none dark:text-gray-500 dark:hover:text-red-400">
                  Report
                </summary>
                <form action="/api/reports/submit" method="POST" className="absolute right-0 mt-2 z-10 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 flex flex-col gap-2 dark:bg-gray-900 dark:border-gray-800">
                  <input type="hidden" name="content_type" value="direct_message" />
                  <input type="hidden" name="content_id" value={id} />
                  <input type="hidden" name="return_to" value={`/messages/${id}`} />
                  <textarea
                    name="reason"
                    required
                    rows={2}
                    placeholder="Why are you reporting this conversation?"
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                  <button type="submit" className="self-start bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70">
                    Submit report
                  </button>
                </form>
              </details>
              <form action={`/api/messages/${id}/block`} method="POST">
                <ConfirmSubmitButton
                  confirmMessage={`Block ${other.full_name || 'this person'}? They won't be able to message you again.`}
                  className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                >
                  Block
                </ConfirmSubmitButton>
              </form>
            </div>
          )}
        </div>

        <MessageThread
          conversationId={id}
          currentUserId={user.id}
          initialMessages={messages ?? []}
          variant="purple"
        />
      </div>
    </WorkspaceShell>
  )
}
