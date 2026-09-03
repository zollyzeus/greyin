import { createClient } from '@/app/lib/supabase/server'
import { absoluteUrl } from '@/app/lib/site-url'
import { sendEmail } from '@/app/lib/email'
import { NextResponse } from 'next/server'

// No pg_cron in this deployment, so the weekly digest is admin-triggered
// rather than scheduled — click "Send weekly digest" and it goes out
// immediately, covering whatever published in the last 7 days.
export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts } = await supabase
    .from('posts')
    .select('title, slug, excerpt')
    .eq('status', 'published')
    .gte('published_at', sevenDaysAgo)
    .order('published_at', { ascending: false })

  if (!posts || posts.length === 0) {
    return NextResponse.redirect(absoluteUrl('/admin?error=' + encodeURIComponent('No posts published in the last 7 days — nothing to send.')))
  }

  const { data: subscribers } = await supabase
    .from('newsletter_subscribers')
    .select('email')
    .is('unsubscribed_at', null)

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.redirect(absoluteUrl('/admin?error=' + encodeURIComponent('No active subscribers.')))
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://greymatters.greyin.net'
  const postsHtml = posts
    .map((p) => `<li><a href="${siteUrl}/posts/${p.slug}">${p.title}</a><p>${p.excerpt || ''}</p></li>`)
    .join('')
  const html = `
    <h2>This week on GreyMatters</h2>
    <ul>${postsHtml}</ul>
    <p><a href="${siteUrl}">Visit GreyMatters</a></p>
  `

  let sent = 0
  for (const sub of subscribers) {
    const ok = await sendEmail({ to: sub.email, subject: 'This week on GreyMatters', html })
    if (ok) sent++
  }

  return NextResponse.redirect(absoluteUrl(`/admin?success=${sent}`))
}
