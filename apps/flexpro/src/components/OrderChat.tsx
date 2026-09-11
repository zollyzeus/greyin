'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Loader2 } from 'lucide-react'

interface Message {
  id: string
  order_id: string
  sender_id: string
  message: string
  attachments: any[]
  read_at: string | null
  created_at: string
  sender: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

interface OrderChatProps {
  orderId: string
  currentUserId: string
}

export default function OrderChat({ orderId, currentUserId }: OrderChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setLoading(false)
    }
  }

  // Send message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      })

      if (response.ok) {
        const data = await response.json()
        setMessages([...messages, data.message])
        setNewMessage('')
        scrollToBottom()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load messages on mount
  useEffect(() => {
    fetchMessages()
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000)
    
    return () => clearInterval(interval)
  }, [orderId])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[500px]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 rounded-t-lg dark:bg-gray-950">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.sender_id === currentUserId
            
            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                  {!isOwnMessage && (
                    <div className="text-xs text-gray-600 mb-1 px-1 dark:text-gray-400">
                      {msg.sender?.full_name || 'User'}
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      isOwnMessage
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-200 dark:bg-gray-900 dark:text-gray-50 dark:border-gray-800'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                  <div className={`text-xs text-gray-500 mt-1 px-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.created_at).toLocaleString()}
                    {isOwnMessage && msg.read_at && (
                      <span className="ml-2 text-indigo-400">✓✓</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={sendMessage} className="border-t bg-white p-4 rounded-b-lg dark:bg-gray-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
