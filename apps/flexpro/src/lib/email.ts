// Email notification service, sent via the platform's own SMTP relay (the
// same Hostinger account GoTrue already uses for auth emails) rather than a
// third-party provider — no separate API key/account needed.
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
    const senderName = process.env.SMTP_SENDER_NAME || 'FlexPro Marketplace'
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

// Email template utilities
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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          background-color: #667eea;
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
          border-left: 4px solid #667eea;
          padding: 15px;
          margin: 20px 0;
        }
        .amount {
          font-size: 28px;
          font-weight: bold;
          color: #667eea;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎯 FlexPro Marketplace</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>© 2026 FlexPro Marketplace. All rights reserved.</p>
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Order confirmation email (buyer)
export async function sendOrderConfirmationEmail(params: {
  buyerEmail: string
  buyerName: string
  orderId: string
  gigTitle: string
  amount: number
  packageType: string
}) {
  const content = `
    <h2>Order Confirmed! 🎉</h2>
    <p>Hi ${params.buyerName},</p>
    <p>Your order has been confirmed and payment received successfully.</p>
    
    <div class="info-box">
      <strong>Order Details:</strong><br>
      Order ID: #${params.orderId.slice(0, 8)}<br>
      Gig: ${params.gigTitle}<br>
      Package: ${params.packageType}<br>
      Amount: <span class="amount">₹${params.amount.toLocaleString()}</span>
    </div>
    
    <p>The seller will start working on your order soon. You'll receive a notification when the work is in progress.</p>
    
    <a href="https://flexpro.greyin.net/orders/${params.orderId}" class="button">View Order</a>
    
    <p>Thank you for choosing FlexPro!</p>
  `

  return sendEmail({
    to: { email: params.buyerEmail, name: params.buyerName },
    subject: `Order Confirmed - ${params.gigTitle}`,
    html: createEmailLayout(content),
  })
}

// Payment received email (seller)
export async function sendPaymentReceivedEmail(params: {
  sellerEmail: string
  sellerName: string
  orderId: string
  gigTitle: string
  amount: number
  buyerName: string
}) {
  const content = `
    <h2>New Order Received! 💰</h2>
    <p>Hi ${params.sellerName},</p>
    <p>Great news! You've received a new order and payment has been confirmed.</p>
    
    <div class="info-box">
      <strong>Order Details:</strong><br>
      Order ID: #${params.orderId.slice(0, 8)}<br>
      Gig: ${params.gigTitle}<br>
      Buyer: ${params.buyerName}<br>
      Amount: <span class="amount">₹${params.amount.toLocaleString()}</span>
    </div>
    
    <p>Please start working on this order and mark it as "In Progress" when you begin.</p>
    
    <a href="https://flexpro.greyin.net/orders/${params.orderId}" class="button">Start Working</a>
    
    <p>Good luck with the project!</p>
  `

  return sendEmail({
    to: { email: params.sellerEmail, name: params.sellerName },
    subject: `New Order - ${params.gigTitle}`,
    html: createEmailLayout(content),
  })
}

// Order in progress email (buyer)
export async function sendOrderInProgressEmail(params: {
  buyerEmail: string
  buyerName: string
  orderId: string
  gigTitle: string
  sellerName: string
}) {
  const content = `
    <h2>Work Started! 🚀</h2>
    <p>Hi ${params.buyerName},</p>
    <p>${params.sellerName} has started working on your order.</p>
    
    <div class="info-box">
      <strong>Order Details:</strong><br>
      Order ID: #${params.orderId.slice(0, 8)}<br>
      Gig: ${params.gigTitle}<br>
      Seller: ${params.sellerName}
    </div>
    
    <p>You can track the progress and communicate with the seller through the order page.</p>
    
    <a href="https://flexpro.greyin.net/orders/${params.orderId}" class="button">Track Order</a>
  `

  return sendEmail({
    to: { email: params.buyerEmail, name: params.buyerName },
    subject: `Work Started - ${params.gigTitle}`,
    html: createEmailLayout(content),
  })
}

// Deliverable uploaded email (buyer)
export async function sendDeliverableUploadedEmail(params: {
  buyerEmail: string
  buyerName: string
  orderId: string
  gigTitle: string
  sellerName: string
  deliverableCount: number
}) {
  const content = `
    <h2>Deliverable Ready! 📦</h2>
    <p>Hi ${params.buyerName},</p>
    <p>${params.sellerName} has uploaded the deliverable(s) for your order.</p>
    
    <div class="info-box">
      <strong>Order Details:</strong><br>
      Order ID: #${params.orderId.slice(0, 8)}<br>
      Gig: ${params.gigTitle}<br>
      Files: ${params.deliverableCount} deliverable(s)
    </div>
    
    <p>Please review the deliverables and accept the delivery if you're satisfied with the work.</p>
    
    <a href="https://flexpro.greyin.net/orders/${params.orderId}" class="button">Review & Accept</a>
  `

  return sendEmail({
    to: { email: params.buyerEmail, name: params.buyerName },
    subject: `Deliverable Ready - ${params.gigTitle}`,
    html: createEmailLayout(content),
  })
}

// Order completed email (seller)
export async function sendOrderCompletedEmail(params: {
  sellerEmail: string
  sellerName: string
  orderId: string
  gigTitle: string
  buyerName: string
  amount: number
}) {
  const content = `
    <h2>Order Completed! ✅</h2>
    <p>Hi ${params.sellerName},</p>
    <p>${params.buyerName} has accepted the delivery and marked the order as completed.</p>
    
    <div class="info-box">
      <strong>Order Details:</strong><br>
      Order ID: #${params.orderId.slice(0, 8)}<br>
      Gig: ${params.gigTitle}<br>
      Amount: <span class="amount">₹${params.amount.toLocaleString()}</span>
    </div>
    
    <p>The payment will be processed according to our payout schedule. Great job!</p>
    
    <a href="https://flexpro.greyin.net/orders/${params.orderId}" class="button">View Order</a>
  `

  return sendEmail({
    to: { email: params.sellerEmail, name: params.sellerName },
    subject: `Order Completed - ${params.gigTitle}`,
    html: createEmailLayout(content),
  })
}

// Payment failed email (buyer)
export async function sendPaymentFailedEmail(params: {
  buyerEmail: string
  buyerName: string
  orderId: string
  gigTitle: string
  amount: number
  errorDescription?: string
}) {
  const content = `
    <h2>Payment Failed ❌</h2>
    <p>Hi ${params.buyerName},</p>
    <p>Unfortunately, your payment could not be processed.</p>
    
    <div class="info-box">
      <strong>Order Details:</strong><br>
      Order ID: #${params.orderId.slice(0, 8)}<br>
      Gig: ${params.gigTitle}<br>
      Amount: ₹${params.amount.toLocaleString()}<br>
      ${params.errorDescription ? `Reason: ${params.errorDescription}` : ''}
    </div>
    
    <p>Please try again or contact our support team if the problem persists.</p>
    
    <a href="https://flexpro.greyin.net/gigs" class="button">Try Again</a>
  `

  return sendEmail({
    to: { email: params.buyerEmail, name: params.buyerName },
    subject: `Payment Failed - ${params.gigTitle}`,
    html: createEmailLayout(content),
  })
}

// Refund processed email (buyer)
export async function sendRefundProcessedEmail(params: {
  buyerEmail: string
  buyerName: string
  orderId: string
  gigTitle: string
  refundAmount: number
}) {
  const content = `
    <h2>Refund Processed 💳</h2>
    <p>Hi ${params.buyerName},</p>
    <p>Your refund has been processed successfully.</p>
    
    <div class="info-box">
      <strong>Refund Details:</strong><br>
      Order ID: #${params.orderId.slice(0, 8)}<br>
      Gig: ${params.gigTitle}<br>
      Refund Amount: <span class="amount">₹${params.refundAmount.toLocaleString()}</span>
    </div>
    
    <p>The refund will be credited to your original payment method within 5-7 business days.</p>
    
    <a href="https://flexpro.greyin.net/orders/${params.orderId}" class="button">View Order</a>
  `

  return sendEmail({
    to: { email: params.buyerEmail, name: params.buyerName },
    subject: `Refund Processed - ${params.gigTitle}`,
    html: createEmailLayout(content),
  })
}
