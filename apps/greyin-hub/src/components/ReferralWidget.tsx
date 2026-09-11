'use client'

import { useState } from 'react'
import { Gift, Copy, Check } from 'lucide-react'

// Platform-wide referral program (138_referral_system.sql) -- lives on
// Hub's dashboard per the same "no pillar affiliation -> lives on Hub"
// convention as career-path.ts and PeerProjectsSection. The code itself
// is fetched server-side in dashboard/page.tsx (create_referral_code()
// is an idempotent get-or-create RPC); this component only handles the
// copy-link interaction, which needs the browser clipboard API.
export function ReferralWidget({ code, joinedCount }: { code: string; joinedCount: number }) {
  const [copied, setCopied] = useState(false)
  const link = typeof window !== 'undefined' ? `${window.location.origin}/referral/redeem?code=${code}` : `/referral/redeem?code=${code}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard permission denied or unavailable -- the link is still
      // visible and selectable in the input below, so nothing is lost.
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6 dark:bg-gray-900">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
        <Gift className="w-5 h-5" />
        Invite people to Greyin
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Share your link. Each person who joins through it, once, earns you reputation — up to 4 rewarded referrals.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 dark:bg-gray-950 dark:border-gray-800 dark:text-gray-200"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center justify-center gap-2 text-sm font-medium bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-700 transition"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {joinedCount === 0
          ? 'No one has joined through your link yet.'
          : `${joinedCount} ${joinedCount === 1 ? 'person has' : 'people have'} joined through your link.`}
      </p>
    </div>
  )
}
