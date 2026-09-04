import { UserPlus, UserMinus } from 'lucide-react'

/**
 * Platform-wide follow/unfollow -- writes into the one shared
 * user_follows table regardless of which app the click happens in
 * (053_activity_feed.sql). Mirrors saltnpepper-community's FollowButton.
 */
export function FollowButton({
  targetUserId,
  isFollowing,
  next,
}: {
  targetUserId: string
  isFollowing: boolean
  next: string
}) {
  return (
    <form action={isFollowing ? '/api/follows/delete' : '/api/follows/create'} method="POST" className="mt-3">
      <input type="hidden" name="target_user_id" value={targetUserId} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        className={
          isFollowing
            ? 'flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-red-600 dark:text-gray-400'
            : 'flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
        }
      >
        {isFollowing ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {isFollowing ? 'Unfollow' : 'Follow'}
      </button>
    </form>
  )
}
