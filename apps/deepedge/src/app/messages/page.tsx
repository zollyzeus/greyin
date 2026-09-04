import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, ArrowLeft, MessageCircle } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function MessagesInboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/messages')
  }

  const { data: myConversations } = await supabase
    .from('conversation_participants')
    .select('conversation_id, conversations ( id, last_message_at )')
    .eq('user_id', user.id)

  const conversationIds = (myConversations || []).map((c: any) => c.conversation_id)

  const { data: otherParticipants } = conversationIds.length
    ? await supabase
        .from('conversation_participants')
        .select('conversation_id, profiles ( id, full_name )')
        .in('conversation_id', conversationIds)
        .neq('user_id', user.id)
    : { data: [] }

  const otherByConversation = new Map((otherParticipants || []).map((p: any) => [p.conversation_id, p.profiles]))

  const conversations = (myConversations || [])
    .map((c: any) => ({
      id: c.conversation_id,
      lastMessageAt: c.conversations?.last_message_at,
      other: otherByConversation.get(c.conversation_id),
    }))
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Building2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <span className="ml-2 text-2xl font-bold">DeepEdge</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <MessageCircle className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Messages</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md divide-y dark:bg-gray-900">
          {conversations.length > 0 ? (
            conversations.map((c) => (
              <Link key={c.id} href={`/messages/${c.id}`} className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                <p className="font-medium text-gray-900 dark:text-gray-50">{c.other?.full_name || 'Member'}</p>
                <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">{new Date(c.lastMessageAt).toLocaleString()}</p>
              </Link>
            ))
          ) : (
            <p className="p-6 text-gray-500 text-sm dark:text-gray-400">No conversations yet.</p>
          )}
        </div>
      </div>
    </main>
  )
}
