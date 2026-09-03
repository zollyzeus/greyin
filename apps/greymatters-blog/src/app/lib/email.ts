// Same platform SMTP relay used by FlexPro (see that app's lib/email.ts)
// — no separate account needed, falls back to console logging in dev.

import nodemailer from 'nodemailer'

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter() {
  if (transporter) return transporter
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return transporter
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  const smtp = getTransporter()

  if (!smtp) {
    console.log('📧 Email notification (SMTP not configured):', to, subject)
    return true
  }

  try {
    const senderName = process.env.SMTP_SENDER_NAME || 'GreyMatters'
    await smtp.sendMail({
      from: `"${senderName}" <${process.env.SMTP_ADMIN_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}
