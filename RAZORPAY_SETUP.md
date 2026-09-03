# Razorpay Payment Integration Setup Guide

## Overview
FreeAgent Marketplace integrates Razorpay for secure payment processing. This guide will help you set up Razorpay API keys and webhooks.

## Step 1: Create a Razorpay Account

1. Visit [https://dashboard.razorpay.com/signup](https://dashboard.razorpay.com/signup)
2. Complete the registration process
3. Verify your email and complete KYC (for production payments)

## Step 2: Get Your API Keys

### Test Mode Keys (for development)
1. Log into Razorpay Dashboard
2. Click on **Settings** → **API Keys**
3. Generate **Test Keys** (they start with `rzp_test_`)
4. Copy both the **Key ID** and **Key Secret**

### Live Mode Keys (for production)
1. Complete your KYC verification
2. Switch to **Live Mode** in the dashboard
3. Click on **Settings** → **API Keys**
4. Generate **Live Keys** (they start with `rzp_live_`)
5. Copy both the **Key ID** and **Key Secret**

## Step 3: Configure Environment Variables

Edit `/deployment/.env` and update the following variables:

```env
# For Test/Development
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_TEST_SECRET_HERE
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX

# For Production (after KYC approval)
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_LIVE_SECRET_HERE
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXX
```

⚠️ **Security Note**: 
- `RAZORPAY_KEY_SECRET` is **PRIVATE** - never expose it in frontend code
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` is safe to expose (used in browser)

## Step 4: Set Up Webhooks (Optional but Recommended)

Webhooks allow Razorpay to notify your server about payment events.

1. In Razorpay Dashboard, go to **Settings** → **Webhooks**
2. Click **Create New Webhook**
3. Enter the webhook URL:
   ```
   https://freeagent.greyin.net/api/webhooks/razorpay
   ```
4. Select these events:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
   - `refund.created`
5. Copy the **Webhook Secret**
6. Add it to `.env`:
   ```env
   RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET_HERE
   ```

## Step 5: Test the Integration

### Using Test Mode
1. Set test keys in `.env`
2. Redeploy the frontend:
   ```bash
   cd deployment
   ./deploy-frontend.sh
   ```
3. Visit https://freeagent.greyin.net/gigs
4. Select a gig and click "Order Now"
5. Use Razorpay's test cards:
   - **Success**: `4111 1111 1111 1111`
   - **Failure**: `4000 0000 0000 0002`
   - CVV: any 3 digits
   - Expiry: any future date

### Test Card Numbers
| Card Number | Type | Expected Behavior |
|------------|------|-------------------|
| 4111 1111 1111 1111 | Visa | Payment Success |
| 5555 5555 5555 4444 | Mastercard | Payment Success |
| 4000 0000 0000 0002 | Visa | Payment Declined |

## Step 6: Go Live

1. Complete KYC verification in Razorpay Dashboard
2. Switch to **Live Mode**
3. Generate Live API Keys
4. Update `.env` with live keys
5. Redeploy:
   ```bash
   cd deployment
   ./deploy-frontend.sh
   ```

## Payment Flow

### 1. Order Creation
- User clicks "Order Now" on a gig
- API creates Razorpay order via `/api/orders/create`
- Returns order ID and payment details

### 2. Payment Processing
- Razorpay Checkout modal opens
- User enters card details
- Razorpay processes payment securely

### 3. Payment Verification
- On success, payment signature is verified via `/api/orders/verify`
- Order status updated to "paid"
- User redirected to success page

### 4. Webhook Notifications (Future)
- Razorpay sends real-time updates to `/api/webhooks/razorpay`
- Server updates order status automatically
- Email notifications sent to buyer and seller

## Pricing

### Razorpay Fees
- **Domestic Cards**: 2% per transaction
- **International Cards**: 3% per transaction
- **Net Banking**: 2% per transaction
- **UPI**: 2% per transaction
- **Wallets**: 2% per transaction

### Platform Commission
- Current: **0%** (no platform fee)
- Seller receives: Order Amount - Razorpay Fee - Service Fee (2%)

## Security Best Practices

1. ✅ **NEVER** commit API secrets to Git
2. ✅ Use environment variables for all sensitive data
3. ✅ Verify payment signatures on server-side
4. ✅ Enable HTTPS for all webhook endpoints
5. ✅ Store webhook secrets securely
6. ✅ Implement rate limiting on payment endpoints
7. ✅ Log all payment transactions with timestamps

## Troubleshooting

### Payment Creation Fails
- Check if API keys are correct in `.env`
- Verify Razorpay account is active
- Check server logs: `docker service logs greyin-frontend_freeagent_web`

### Payment Verification Fails
- Signature mismatch: Check if `RAZORPAY_KEY_SECRET` matches the one used to create the order
- Network timeout: Check Razorpay API status

### Webhook Not Receiving Events
- Verify webhook URL is accessible from the internet
- Check if webhook secret is correct
- Test webhook using Razorpay Dashboard's "Test Webhook" feature

## Support

- **Razorpay Docs**: https://razorpay.com/docs/
- **API Reference**: https://razorpay.com/docs/api/
- **Support**: support@razorpay.com

## Next Steps

After setting up payments:
1. ✅ Configure payment webhooks
2. ✅ Set up payout accounts for sellers (Razorpay Route)
3. ✅ Implement refund handling
4. ✅ Add order tracking and delivery features
5. ✅ Set up email notifications for payments
