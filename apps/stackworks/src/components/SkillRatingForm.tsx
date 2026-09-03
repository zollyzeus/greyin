'use client'

import { useEffect, useState } from 'react'
import { Star, Loader2 } from 'lucide-react'

interface SavedRating {
  skill: string
  rating: number
  stage: 'initial' | 'verified'
}

/**
 * Bidirectional skill ratings between a Builder and Supporter
 * (054_skill_endorsements_and_ratings.sql). An initial rating is
 * allowed once they've actually interacted (a real chat, or the
 * traditional ask-closed+accepted signal) -- the RLS policy is the
 * real gate, this form just tries and surfaces a rejection if neither
 * condition is met yet. Once a verified_outcomes row exists for this
 * application, the same rating can be revised (not re-created).
 */
export default function SkillRatingForm({
  applicationId,
  rateeId,
  skills,
}: {
  applicationId: string
  rateeId: string
  skills: string[]
}) {
  const [ratings, setRatings] = useState<Record<string, SavedRating>>({})
  const [verified, setVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/applications/${applicationId}/skill-ratings`)
      .then((res) => res.json())
      .then((data) => {
        const bySkill: Record<string, SavedRating> = {}
        for (const r of data.ratings || []) bySkill[r.skill] = r
        setRatings(bySkill)
        setVerified(!!data.verified)
      })
      .finally(() => setLoading(false))
  }, [applicationId])

  if (!skills || skills.length === 0) return null
  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
  }

  async function rate(skill: string, rating: number, revise: boolean) {
    setSubmitting(skill)
    setError(null)
    try {
      const res = await fetch(`/api/applications/${applicationId}/skill-ratings`, {
        method: revise ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(revise ? { skill, rating } : { skill, rating, ratee_id: rateeId }),
      })
      const data = await res.json()
      if (res.ok) {
        setRatings((prev) => ({ ...prev, [skill]: { skill, rating, stage: revise ? 'verified' : 'initial' } }))
      } else {
        setError(data.error || 'Could not save rating — you may need to have interacted first.')
      }
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t">
      <p className="text-sm font-medium text-gray-900 mb-2">Rate specific skills</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-2">
        {skills.map((skill) => {
          const saved = ratings[skill]
          const canRevise = saved?.stage === 'initial' && verified
          const locked = saved && !canRevise
          const current = saved?.rating || 0
          return (
            <div key={skill} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">{skill}</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={!!locked || submitting === skill}
                    onClick={() => rate(skill, n, !!canRevise)}
                    aria-label={`Rate ${skill} ${n} out of 5`}
                  >
                    <Star className={`w-4 h-4 ${n <= current ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                  </button>
                ))}
                {saved?.stage === 'verified' && <span className="text-xs text-teal-600 ml-1">Verified</span>}
                {saved?.stage === 'initial' && !verified && <span className="text-xs text-gray-400 ml-1">Saved</span>}
                {canRevise && <span className="text-xs text-gray-400 ml-1">Tap to revise</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
