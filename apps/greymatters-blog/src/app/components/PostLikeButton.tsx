'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'

// Lightweight one-shot "like" toggle (139_post_reactions.sql) -- mirrors
// StackWorks' project_upvotes pattern exactly (one row per user per
// post, a trigger keeps posts.like_count in sync). Not a repeatable
// multi-click counter -- see that migration's header comment for why.
export function PostLikeButton({
  slug,
  initiallyLiked,
  initialCount,
  loggedIn,
}: {
  slug: string
  initiallyLiked: boolean
  initialCount: number
  loggedIn: boolean
}) {
  const [liked, setLiked] = useState(initiallyLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)

  async function handleClick() {
    if (!loggedIn) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
      return
    }
    if (pending) return
    setPending(true)

    // Optimistic toggle -- reverted on failure.
    const nextLiked = !liked
    setLiked(nextLiked)
    setCount((c) => c + (nextLiked ? 1 : -1))

    const res = await fetch(`/api/posts/${slug}/like`, {
      method: nextLiked ? 'POST' : 'DELETE',
    })

    if (!res.ok) {
      setLiked(liked)
      setCount((c) => c + (nextLiked ? -1 : 1))
    }
    setPending(false)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`flex items-center gap-1 transition ${
        liked ? 'text-pink-600 dark:text-pink-400' : 'text-gray-500 hover:text-pink-600 dark:text-gray-400 dark:hover:text-pink-400'
      }`}
      aria-pressed={liked}
    >
      <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
      <span>{count} {count === 1 ? 'like' : 'likes'}</span>
    </button>
  )
}
