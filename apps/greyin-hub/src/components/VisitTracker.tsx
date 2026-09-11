'use client'

import { useEffect } from 'react'

// Anonymous page-visit tracking (Emergent-parity gap #2 part 2, 145) --
// no visible UI, fires once per mount. `keepalive` lets the request
// survive if the visitor navigates away before it completes.
export function VisitTracker() {
  useEffect(() => {
    fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {
      // Best-effort only -- a failed visit ping should never affect the
      // visitor's experience of the page.
    })
  }, [])

  return null
}
