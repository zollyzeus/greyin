import { ThumbsUp } from 'lucide-react'

/**
 * Endorsement, gated to a real collaboration (064_ethos_verification_gates.sql)
 * -- the calling page only renders this when the viewer has a real
 * accepted StackWorks ask or completed FlexPro order with the
 * endorsee, matching the RLS policy exactly.
 */
export function SkillEndorseButton({
  targetUserId,
  skill,
  isEndorsed,
  endorsementCount,
}: {
  targetUserId: string
  skill: string
  isEndorsed: boolean
  endorsementCount: number
}) {
  return (
    <form
      action={isEndorsed ? `/api/skills/${targetUserId}/unendorse` : `/api/skills/${targetUserId}/endorse`}
      method="POST"
      className="inline-flex items-center gap-1"
    >
      <input type="hidden" name="skill" value={skill} />
      <button
        type="submit"
        className={
          isEndorsed
            ? 'flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full'
            : 'flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-full'
        }
      >
        <ThumbsUp className="h-3 w-3" />
        {endorsementCount > 0 ? endorsementCount : 'Endorse'}
      </button>
    </form>
  )
}
