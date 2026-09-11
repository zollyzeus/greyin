'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'

/**
 * AI enhancement (Phase B1) -- same "assist" shape as CoverLetterAssist/
 * JobPostAssist, shown only for an application already at the real
 * 'interview' status. Only application_id is sent; the job/candidate
 * data itself is looked up server-side, scoped by RLS to this user's
 * own application.
 */
export function InterviewPrepAssist({ applicationId }: { applicationId: string }) {
  const [questions, setQuestions] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClick = async () => {
    setLoading(true)
    setError('')
    setQuestions('')
    try {
      const res = await fetch('/api/applications/interview-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not get prep questions.')
        return
      }
      setQuestions(data.questions)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 disabled:opacity-60 dark:text-purple-400 dark:hover:text-purple-300"
      >
        <Sparkles className="h-3 w-3" />
        {loading ? 'Preparing…' : 'AI interview prep'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1 dark:text-red-400">{error}</p>}
      {questions && (
        <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-2 whitespace-pre-line dark:text-gray-300 dark:bg-gray-950 dark:border-gray-800">
          {questions}
        </p>
      )}
    </div>
  )
}
