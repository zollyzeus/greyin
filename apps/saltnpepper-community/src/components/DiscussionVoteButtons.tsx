'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

// Real up/down voting (146_discussion_voting.sql) -- mirrors
// PostLikeButton.tsx's optimistic-update-with-revert-on-failure
// pattern. myVote/score are net values: myVote is -1/0/1, score can go
// negative for genuinely poorly-received discussions.
export function DiscussionVoteButtons({
  discussionId,
  initialScore,
  initialMyVote,
  loggedIn,
  size = 'md',
}: {
  discussionId: string
  initialScore: number
  initialMyVote: number
  loggedIn: boolean
  size?: 'sm' | 'md'
}) {
  const [score, setScore] = useState(initialScore)
  const [myVote, setMyVote] = useState(initialMyVote)
  const [pending, setPending] = useState(false)

  async function vote(direction: 1 | -1, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!loggedIn) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
      return
    }
    if (pending) return
    setPending(true)

    const nextValue = myVote === direction ? 0 : direction
    const prevScore = score
    const prevMyVote = myVote

    // Optimistic update -- reverted on failure.
    setScore((s) => s - prevMyVote + nextValue)
    setMyVote(nextValue)

    const res = await fetch(`/api/discussions/${discussionId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: nextValue }),
    })

    if (!res.ok) {
      setScore(prevScore)
      setMyVote(prevMyVote)
    }
    setPending(false)
  }

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const textSize = size === 'sm' ? 'text-sm' : 'text-base'

  return (
    <div className="flex flex-col items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => vote(1, e)}
        disabled={pending}
        aria-pressed={myVote === 1}
        aria-label="Upvote"
        className={`p-0.5 rounded transition ${myVote === 1 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 hover:text-purple-600 dark:text-gray-500 dark:hover:text-purple-400'}`}
      >
        <ChevronUp className={iconSize} />
      </button>
      <span className={`font-semibold ${textSize} ${score > 0 ? 'text-purple-600 dark:text-purple-400' : score < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {score}
      </span>
      <button
        type="button"
        onClick={(e) => vote(-1, e)}
        disabled={pending}
        aria-pressed={myVote === -1}
        aria-label="Downvote"
        className={`p-0.5 rounded transition ${myVote === -1 ? 'text-red-500 dark:text-red-400' : 'text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400'}`}
      >
        <ChevronDown className={iconSize} />
      </button>
    </div>
  )
}
