'use client'

import type { ReactNode, MouseEvent } from 'react'

/**
 * Drop-in replacement for a plain `<button type="submit">` inside a
 * server-rendered `<form action="..." method="POST">` -- adds a native
 * confirm() gate before an irreversible/destructive submit, without
 * requiring the surrounding page to become a client component. The
 * form still submits natively (progressive enhancement preserved);
 * this only intercepts the click to ask first.
 */
export function ConfirmSubmitButton({
  confirmMessage,
  className,
  children,
}: {
  confirmMessage: string
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault()
        }
      }}
    >
      {children}
    </button>
  )
}
