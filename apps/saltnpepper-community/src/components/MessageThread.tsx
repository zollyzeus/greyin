'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MessageRow {
  id: string
  sender_id: string
  body: string
  created_at: string
}

// Real-time DM thread (147_direct_messages_realtime.sql, Emergent-parity
// gap #2) -- mirrors NotificationBell.tsx's postgres_changes subscription
// pattern, scoped to this one conversation instead of a user id. Sends go
// straight through the client Supabase insert (RLS -- sender_id = auth.uid()
// AND caller is a participant -- is already the real boundary, same as the
// pre-existing form-POST route relied on) rather than reworking that route,
// which stays untouched for no-JS fallback.
export function MessageThread({
  conversationId,
  currentUserId,
  initialMessages,
  variant,
}: {
  conversationId: string
  currentUserId: string
  initialMessages: MessageRow[]
  variant: 'indigo' | 'purple'
}) {
  const [supabase] = useState(() => createClient())
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const channel = supabase
      .channel(`direct_messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as MessageRow
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setDraft('')

    const { error } = await supabase
      .from('direct_messages')
      .insert({ conversation_id: conversationId, sender_id: currentUserId, body })

    if (error) {
      setDraft(body)
    }
    setSending(false)
  }

  const sentBubble = variant === 'indigo' ? 'bg-indigo-600 text-white' : 'bg-purple-600 text-white'
  const sendButton =
    variant === 'indigo'
      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
      : 'bg-purple-600 text-white hover:bg-purple-700'
  const focusRing = variant === 'indigo' ? 'focus:ring-indigo-500 focus:border-indigo-500' : 'focus:ring-purple-500 focus:border-purple-500'

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6 mb-4 space-y-4 min-h-[200px] dark:bg-gray-900">
        {messages.length > 0 ? (
          <>
            {messages.map((m) => (
              <div key={m.id} className={m.sender_id === currentUserId ? 'text-right' : 'text-left'}>
                <span
                  className={`inline-block px-4 py-2 rounded-lg text-sm ${
                    m.sender_id === currentUserId ? sentBubble : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50'
                  }`}
                >
                  {m.body}
                </span>
                <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">{new Date(m.created_at).toLocaleString()}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        ) : (
          <p className="text-gray-500 text-sm dark:text-gray-400">No messages yet — say hello.</p>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          type="text"
          required
          placeholder="Type a message..."
          className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none ${focusRing} dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100`}
        />
        <button type="submit" disabled={sending} className={`px-6 py-2 rounded-lg font-medium disabled:opacity-50 ${sendButton}`}>
          Send
        </button>
      </form>
    </>
  )
}
