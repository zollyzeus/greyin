import { NextResponse } from 'next/server'

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://greymatters.greyin.net'

  // Plain stateless fetch, not the cookie-bound SSR client -- feed readers
  // hit this with no session anyway, and this being the first Supabase call
  // on a fresh client with no preceding .auth.* call was found to risk the
  // @supabase/ssr session-recovery crash the auth signup routes had. As a
  // side benefit, an anon-key fetch naturally limits results to
  // view_audience='public' posts under RLS (038), which is the correct
  // scope for a public feed regardless.
  const postsRes = await fetch(
    `${process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/posts?status=eq.published&select=title,slug,excerpt,published_at&order=published_at.desc&limit=50`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
    }
  )
  // A failed request can still resolve with valid JSON that isn't a post
  // array -- a PostgREST error body ({message, code, ...}) on a non-2xx
  // response, most commonly. .catch(() => []) alone only guards a JSON
  // *parse* failure; it does nothing for a well-formed non-array body,
  // which then reaches posts.map() below and throws (found via a local
  // build with no reachable Supabase host, but the same shape of failure
  // -- a non-2xx response with a parseable body -- can happen in
  // production too, so this is a real defensive gap, not just a
  // local-environment quirk). Gate on both postsRes.ok and Array.isArray
  // so any failure mode here degrades to an empty feed instead of a
  // 500.
  let posts: Array<{ title: string; slug: string; excerpt: string | null; published_at: string }> = []
  if (postsRes.ok) {
    const body = await postsRes.json().catch(() => null)
    if (Array.isArray(body)) posts = body
  }

  const items = posts
    .map(
      (p) => `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${siteUrl}/posts/${p.slug}</link>
      <guid>${siteUrl}/posts/${p.slug}</guid>
      <description>${escapeXml(p.excerpt || '')}</description>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
    </item>`
    )
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>GreyMatters</title>
    <link>${siteUrl}</link>
    <description>Because Grey Matters — deep-dive technical essays and career insights for senior domain talent.</description>
    <language>en-us</language>
    ${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
