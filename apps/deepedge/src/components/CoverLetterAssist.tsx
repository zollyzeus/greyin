'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'

/**
 * Same progressive-enhancement "assist" pattern as FlexPro's
 * GigQualityAssist.tsx -- but unlike that one, job title/description
 * here are static server-rendered display text, not sibling form
 * fields, so they're passed in as props instead of read off the DOM.
 * The draft is written directly into the (uncontrolled) cover_letter
 * textarea on click -- never on page load, never auto-submitted, the
 * candidate reviews/edits it like anything else they'd type themselves.
 */
export function CoverLetterAssist({
  jobTitle,
  jobDescription,
  companyName,
}: {
  jobTitle: string
  jobDescription: string
  companyName: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClick = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/jobs/cover-letter-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, jobDescription, companyName }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not get a draft.')
        return
      }
      const textarea = document.getElementById('cover_letter') as HTMLTextAreaElement | null
      if (textarea) textarea.value = data.draft
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
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 hover:bg-blue-100 disabled:opacity-60 dark:text-blue-400 dark:border-blue-900 dark:bg-blue-950/40"
      >
        <Sparkles className="w-4 h-4" />
        {loading ? 'Drafting…' : 'Draft with AI'}
      </button>
      {error && <p className="text-xs text-red-600 mt-2 dark:text-red-400">{error}</p>}
    </div>
  )
}
