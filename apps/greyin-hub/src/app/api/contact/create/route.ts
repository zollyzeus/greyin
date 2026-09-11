import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

const SOURCE_APPS = ['deepedge', 'flexpro', 'stackworks', 'saltnpepper', 'greymatters', 'longlist', 'hub']

// Fixes a real bug found by a UI/UX audit (2026-09-11): every app's
// footer "Contact" link pointed at the login-gated /feedback form --
// the wrong destination for a sales/business inquiry from someone with
// no Greyin account. This is fully anonymous (no login required),
// mirroring the anonymous-wishlist pattern (144) rather than feedback's
// deliberate login gate (101). Rate-limited by client IP, same
// extraction/private-IP-skip logic reused for every anonymous write
// this platform has added.
export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()

  const name = (formData.get('name') as string || '').trim()
  const email = (formData.get('email') as string || '').trim()
  const companyName = (formData.get('company_name') as string || '').trim() || null
  const message = (formData.get('message') as string || '').trim()
  const sourceAppRaw = (formData.get('source_app') as string || '').trim()
  const sourceApp = SOURCE_APPS.includes(sourceAppRaw) ? sourceAppRaw : 'hub'

  if (!name || !email || !email.includes('@') || !message) {
    return NextResponse.redirect(
      absoluteUrl(`/contact?app=${sourceApp}&error=` + encodeURIComponent('Please fill in your name, a valid email, and a message.'))
    )
  }

  const rawClientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  const isPrivateOrUnknownIp =
    !rawClientIp || /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1$|f[cd])/i.test(rawClientIp)
  if (!isPrivateOrUnknownIp) {
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_action: 'business_inquiry',
      p_key: rawClientIp,
      p_max_failures: 5,
      p_window_minutes: 60,
    })
    if (!allowed) {
      return NextResponse.redirect(
        absoluteUrl(`/contact?app=${sourceApp}&error=` + encodeURIComponent('Too many messages from this network. Please wait a while and try again.'))
      )
    }
    await supabase.rpc('record_rate_limit_attempt', { p_action: 'business_inquiry', p_key: rawClientIp, p_success: false })
  }

  const { error } = await supabase.from('business_inquiries').insert({
    name,
    email,
    company_name: companyName,
    source_app: sourceApp,
    message,
  })
  if (error) {
    return NextResponse.redirect(
      absoluteUrl(`/contact?app=${sourceApp}&error=` + encodeURIComponent('Could not send your message. Please try again.'))
    )
  }

  return NextResponse.redirect(absoluteUrl(`/contact?app=${sourceApp}&success=1`))
}
