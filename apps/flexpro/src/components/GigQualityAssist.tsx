'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'

/**
 * Same progressive-enhancement pattern as ImageUploader.tsx -- the
 * surrounding form is a plain uncontrolled server-rendered <form>, so
 * this reads the current title/description straight off the DOM by id
 * rather than lifting state up. Informational only: never blocks or
 * disables the real Publish button.
 */
export function GigQualityAssist() {
  const [suggestions, setSuggestions] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClick = async () => {
    const title = (document.getElementById('title') as HTMLInputElement | null)?.value.trim() || ''
    const description = (document.getElementById('description') as HTMLTextAreaElement | null)?.value.trim() || ''
    if (!title || !description) {
      setError('Fill in a title and description first.')
      setSuggestions('')
      return
    }

    setLoading(true)
    setError('')
    setSuggestions('')
    try {
      const res = await fetch('/api/gigs/quality-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not get suggestions.')
        return
      }
      setSuggestions(data.suggestions)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 hover:bg-blue-100 disabled:opacity-60 dark:text-blue-400 dark:border-blue-900 dark:bg-blue-950/40"
      >
        <Sparkles className="w-4 h-4" />
        {loading ? 'Thinking…' : 'Get AI suggestions'}
      </button>
      {error && <p className="text-xs text-red-600 mt-2 dark:text-red-400">{error}</p>}
      {suggestions && (
        <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-2 dark:text-gray-300 dark:bg-gray-950 dark:border-gray-800">
          {suggestions}
        </p>
      )}
    </div>
  )
}
