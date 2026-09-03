'use client'

import { useEffect, useState } from 'react'
import { Star, Loader2 } from 'lucide-react'

/**
 * Skill-level ratings, gated to a real completed order and scoped to
 * the specific skills tagged on that gig (054_skill_endorsements_and_ratings.sql).
 * Only rendered for the buyer, once the order is completed -- the RLS
 * policy is the real gate, this is just the matching UI.
 */
export default function SkillRatingForm({
  orderId,
  rateeId,
  skills,
}: {
  orderId: string
  rateeId: string
  skills: string[]
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [saved, setSaved] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/orders/${orderId}/skill-ratings`)
      .then((res) => res.json())
      .then((data) => {
        const bySkill: Record<string, number> = {}
        for (const r of data.ratings || []) bySkill[r.skill] = r.rating
        setSaved(bySkill)
        setRatings(bySkill)
      })
      .finally(() => setLoading(false))
  }, [orderId])

  if (!skills || skills.length === 0) return null
  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
  }

  async function rate(skill: string, rating: number) {
    setSubmitting(skill)
    try {
      const res = await fetch(`/api/orders/${orderId}/skill-ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill, rating, ratee_id: rateeId }),
      })
      if (res.ok) {
        setSaved((prev) => ({ ...prev, [skill]: rating }))
        setRatings((prev) => ({ ...prev, [skill]: rating }))
      }
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t">
      <p className="text-sm font-medium text-gray-900 mb-2">Rate specific skills</p>
      <div className="space-y-2">
        {skills.map((skill) => {
          const isSaved = saved[skill] != null
          const current = ratings[skill] || 0
          return (
            <div key={skill} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">{skill}</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={isSaved || submitting === skill}
                    onClick={() => rate(skill, n)}
                    aria-label={`Rate ${skill} ${n} out of 5`}
                  >
                    <Star className={`w-4 h-4 ${n <= current ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                  </button>
                ))}
                {isSaved && <span className="text-xs text-gray-400 ml-1">Saved</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
