import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { MessageThread } from '@/components/MessageThread'

export default async function MessageThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/messages/${id}`)
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

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
      variant={profile?.role === 'employer' ? 'employer' : 'candidate'}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      role={profile?.role}
      pageTitle="Messages"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <Link href="/messages" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to messages
        </Link>

        <h1 className="text-xl font-bold text-gray-900 mb-6 dark:text-gray-50">{other?.full_name || 'Conversation'}</h1>

        <MessageThread
          conversationId={id}
          currentUserId={user.id}
          initialMessages={messages ?? []}
          variant="indigo"
        />
      </div>
    </WorkspaceShell>
  )
}
