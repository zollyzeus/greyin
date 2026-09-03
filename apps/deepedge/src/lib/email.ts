// Email notification service, sent via the platform's own SMTP relay (the
// same Hostinger account GoTrue already uses for auth emails, and the
// same one apps/flexpro/src/lib/email.ts already uses) --
// no separate API key/account needed.
// Environment variables required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS

import nodemailer from 'nodemailer'

interface EmailRecipient {
  email: string
  name?: string
}

interface EmailOptions {
  to: EmailRecipient
  subject: string
  html: string
}

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

/**
 * Sends email via the platform SMTP relay.
 * Falls back to console logging if SMTP isn't configured (local dev).
 */
export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  const smtp = getTransporter()

  if (!smtp) {
    console.log('📧 Email notification (SMTP not configured):')
    console.log(`To: ${to.email} (${to.name || 'N/A'})`)
    console.log(`Subject: ${subject}`)
    console.log(`Body: ${html.substring(0, 200)}...`)
    return true
  }

  try {
    const senderName = process.env.SMTP_SENDER_NAME || 'DeepEdge'
    await smtp.sendMail({
      from: `"${senderName}" <${process.env.SMTP_ADMIN_EMAIL || process.env.SMTP_USER}>`,
      to: to.name ? `"${to.name}" <${to.email}>` : to.email,
      subject,
      html,
    })
    console.log('✅ Email sent successfully to', to.email)
    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

export function createEmailLayout(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
        }
        .header {
          background: linear-gradient(135deg, #4F46E5 0%, #4338CA 100%);
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 24px;
        }
        .content {
          padding: 30px;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background-color: #4F46E5;
          color: #ffffff;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          background-color: #f8f8f8;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        .info-box {
          background-color: #f8f9fa;
          border-left: 4px solid #4F46E5;
          padding: 15px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>DeepEdge</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} DeepEdge. All rights reserved.</p>
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Peer Referral Bridge: invites someone without a DeepEdge account yet to
// look at a job a fellow member thought they'd be right for.
export async function sendReferralInviteEmail(params: {
  referredEmail: string
  referrerName: string
  jobTitle: string
  jobUrl: string
  note?: string
}) {
  const content = `
    <h2>${params.referrerName} thinks you'd be a great fit</h2>
    <p>Hi,</p>
    <p>${params.referrerName} referred you to a role on DeepEdge, the age-blind hiring platform for senior professionals.</p>

    <div class="info-box">
      <strong>${params.jobTitle}</strong>
      ${params.note ? `<p style="margin-top: 10px;">"${params.note}"</p>` : ''}
    </div>

    <a href="${params.jobUrl}" class="button">View the role</a>

    <p>No account yet? You can sign up when you view the listing.</p>
  `

  return sendEmail({
    to: { email: params.referredEmail },
    subject: `${params.referrerName} referred you to a role on DeepEdge`,
    html: createEmailLayout(content),
  })
}
