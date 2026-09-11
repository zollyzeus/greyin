'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, X } from 'lucide-react'

type Feedback = 'helpful' | 'not_relevant' | 'already_applied' | 'wrong_fit'

const REASONS: { value: Feedback; label: string }[] = [
  { value: 'not_relevant', label: 'Not the right seniority/type' },
  { value: 'already_applied', label: 'Already applied elsewhere' },
  { value: 'wrong_fit', label: 'Wrong location/remote or comp' },
]

async function submitFeedback(jobId: string, recommendationType: string, feedback: Feedback, note: string | null) {
  const res = await fetch('/api/jobs/recommendation-feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, recommendation_type: recommendationType, feedback, note }),
  })
  return res.ok
}

/**
 * Recommendation-feedback loop, Phase 1 (125). Entirely optional --
 * browsing recommendations is never blocked by this. Thumbs-up is a
 * single click; thumbs-down opens a small inline popover for an
 * optional reason, closable without submitting anything. The actual
 * exclusion effect (this job dropping out of future recommendation
 * lists) happens server-side on next load, not instantly here --
 * this component only shows a lightweight local confirmation.
 */
export function RecommendationFeedback({ jobId, recommendationType, initialFeedback }: {
  jobId: string
  recommendationType: string
  initialFeedback: Feedback | null
}) {
  const [feedback, setFeedback] = useState<Feedback | null>(initialFeedback)
  const [showReasons, setShowReasons] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const stop = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleHelpful = async (e: React.MouseEvent) => {
    stop(e)
    if (submitting) return
    setSubmitting(true)
    const ok = await submitFeedback(jobId, recommendationType, 'helpful', null)
    if (ok) setFeedback('helpful')
    setSubmitting(false)
  }

  const handleReason = async (e: React.MouseEvent, reason: Feedback) => {
    stop(e)
    if (submitting) return
    setSubmitting(true)
    const ok = await submitFeedback(jobId, recommendationType, reason, note.trim() || null)
    if (ok) {
      setFeedback(reason)
      setShowReasons(false)
    }
    setSubmitting(false)
  }

  if (feedback) {
    return (
      <p className="text-xs text-gray-400 mt-2 dark:text-gray-500">
        {feedback === 'helpful' ? 'Thanks — glad this was helpful.' : 'Thanks — you won’t see this one again.'}
      </p>
    )
  }

  return (
    <div className="mt-2 relative" onClick={stop}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleHelpful}
          disabled={submitting}
          aria-label="Helpful"
          className="text-gray-400 hover:text-green-600 dark:hover:text-green-400 disabled:opacity-50"
        >
          <ThumbsUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { stop(e); setShowReasons((v) => !v) }}
          disabled={submitting}
          aria-label="Not relevant"
          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
        >
          <ThumbsDown className="h-4 w-4" />
        </button>
      </div>

      {showReasons && (
        <div
          className="absolute z-10 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3 dark:bg-gray-900 dark:border-gray-700"
          onClick={stop}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Why not?</p>
            <button type="button" onClick={(e) => { stop(e); setShowReasons(false) }} aria-label="Close">
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </div>
          <div className="space-y-1 mb-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={(e) => handleReason(e, r.value)}
                disabled={submitting}
                className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-100 text-gray-700 disabled:opacity-50 dark:hover:bg-gray-800 dark:text-gray-300"
              >
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onClick={stop}
            placeholder="Optional: anything else? (skippable)"
            rows={2}
            maxLength={280}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </div>
      )}
    </div>
  )
}
