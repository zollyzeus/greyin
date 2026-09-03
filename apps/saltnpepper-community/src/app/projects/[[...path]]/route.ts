import { NextResponse } from 'next/server'

// "The Lab" moved to its own app, now at stackworks.greyin.net (formerly
// reachable at the app's original pre-rebrand domain -- rebranded, same
// app/pillar) -- this preserves any
// existing inbound links/bookmarks to /projects* instead of 404ing them.
// Not absoluteUrl() here deliberately: the redirect target is a different
// app entirely, not a path within this one.
export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params
  const suffix = path && path.length > 0 ? `/${path.join('/')}` : ''
  return NextResponse.redirect(`https://stackworks.greyin.net/projects${suffix}`)
}
