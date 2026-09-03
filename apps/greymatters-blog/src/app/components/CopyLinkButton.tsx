'use client'

import { useState } from 'react'

/** The post page itself is a Server Component with no client JS attached
    -- this is pulled out into its own small client island just for the
    one bit of real interactivity (clipboard) the share row needs. */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-semibold"
    >
      {copied ? 'Copied!' : 'Copy Link'}
    </button>
  )
}
