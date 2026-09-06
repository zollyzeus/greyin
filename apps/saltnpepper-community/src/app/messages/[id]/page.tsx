import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function MessageThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
        <h1 className="text-xl font-bold text-gray-900 mb-6 dark:text-gray-50">{other?.full_name || 'Conversation'}</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-4 space-y-4 min-h-[200px] dark:bg-gray-900">
          {messages && messages.length > 0 ? (
            messages.map((m) => (
              <div key={m.id} className={m.sender_id === user.id ? 'text-right' : 'text-left'}>
                <span
                  className={`inline-block px-4 py-2 rounded-lg text-sm ${
                    m.sender_id === user.id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50'
                  }`}
                >
                  {m.body}
                </span>
                <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">{new Date(m.created_at).toLocaleString()}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No messages yet — say hello.</p>
          )}
        </div>

        <form action={`/api/messages/${id}/send`} method="POST" className="flex gap-2">
          <input
            name="body"
            type="text"
            required
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
          <button type="submit" className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium">
            Send
          </button>
        </form>
      </div>
    </WorkspaceShell>
  )
}
