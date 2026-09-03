# Razorpay Payment Integration Guide
## Greyin Platform - FreeAgent Marketplace

**Last Updated:** August 6, 2026  
**Status:** Ready for Implementation

---

## 1. Overview

The Greyin platform integrates **Razorpay** for payment processing in the **FreeAgent Marketplace** (0% commission gig platform). While the platform takes 0% commission, Razorpay provides secure escrow, payment capture, and dispute resolution.

### Why Razorpay?

✅ **India-focused:** INR support, UPI, NetBanking, Cards, Wallets  
✅ **No platform fee:** We charge 0%, Razorpay charges ~2% (industry standard)  
✅ **Automatic escrow:** Funds held until delivery confirmation  
✅ **Instant settlements:** T+1 or instant settlements available  
✅ **Route/Split payments:** Direct transfer to freelancer accounts  
✅ **Webhook events:** Real-time payment status updates  

---

## 2. Database Schema

Migration `002_razorpay_integration.sql` adds:

### Tables Modified:
- **`gig_orders`** - Added Razorpay payment tracking fields
- **`razorpay_webhooks`** - Audit log for all webhook events
- **`razorpay_config`** - Payment gateway settings
- **`payment_analytics`** - View for reporting

### Key Fields in `gig_orders`:

| Field | Type | Purpose |
|-------|------|---------|
| `razorpay_order_id` | TEXT | Order ID from Razorpay (order_xxxxx) |
| `razorpay_payment_id` | TEXT | Payment ID after capture (pay_xxxxx) |
| `razorpay_signature` | TEXT | HMAC signature for verification |
| `payment_status` | ENUM | pending → authorized → captured → refunded |
| `payment_method` | TEXT | card, upi, netbanking, wallet |
| `payment_captured_at` | TIMESTAMP | When payment was captured |
| `refund_id` | TEXT | Refund ID if order cancelled |
| `refund_amount` | INTEGER | Amount refunded (paise) |

---

## 3. Setup Instructions

### Step 1: Razorpay Account Setup

1. **Create Account:** https://dashboard.razorpay.com/signup
2. **Complete KYC:** Business verification required for live mode
3. **Get API Keys:**
   - Navigate to: Settings → API Keys
   - Generate **Test Keys** (for development)
   - Generate **Live Keys** (after KYC approval)

### Step 2: Configure Environment Variables

Edit `/deployment/.env`:

```bash
# PRODUCTION Keys
RAZORPAY_KEY_ID=rzp_live_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_SECRET_KEY

# TEST Keys (for development)
RAZORPAY_TEST_KEY_ID=rzp_test_YOUR_TEST_KEY_ID
RAZORPAY_TEST_KEY_SECRET=YOUR_TEST_SECRET

# Webhook Secret (from Razorpay Dashboard)
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

# Settings
RAZORPAY_CURRENCY=INR
RAZORPAY_PAYMENT_CAPTURE=automatic
RAZORPAY_RECEIPT_PREFIX=GRY

# Frontend (Safe to expose)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_YOUR_KEY_ID
```

### Step 3: Run Database Migration

```bash
cd /media/anand/WD\ BLACK/projects2/greyin/deployment

# Apply migration via Supabase Studio
# 1. Open https://studio.greyin.net
# 2. Login: admin / Infy@121238
# 3. Navigate to SQL Editor
# 4. Run: migrations/002_razorpay_integration.sql

# OR via psql command line:
cat migrations/002_razorpay_integration.sql | \
  docker exec -i $(docker ps --filter "name=supabase_supabase_db" --format "{{.ID}}") \
  psql -U postgres -d postgres
```

### Step 4: Configure Webhooks

**Razorpay Dashboard** → Settings → Webhooks → Add Webhook

**Webhook URL:**
```
https://api.greyin.net/webhooks/razorpay
```

**Events to Subscribe:**
- ✅ payment.authorized
- ✅ payment.captured
- ✅ payment.failed
- ✅ order.paid
- ✅ refund.created
- ✅ refund.processed

**Webhook Secret:** Copy and add to `.env` as `RAZORPAY_WEBHOOK_SECRET`

### Step 5: Redeploy Frontend

```bash
cd /media/anand/WD\ BLACK/projects2/greyin/deployment

# Source environment with Razorpay keys
set -a && source .env && set +a

# Rebuild frontend with new env vars
docker stack deploy -c frontend-stack.yml frontend
```

---

## 4. Payment Flow Implementation

### A. Create Order (Backend - Supabase Function)

```javascript
// Supabase Edge Function: create-razorpay-order
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: Deno.env.get('RAZORPAY_KEY_ID'),
  key_secret: Deno.env.get('RAZORPAY_KEY_SECRET')
});

Deno.serve(async (req) => {
  const { orderId, amount, currency = 'INR' } = await req.json();
  
  // Create Razorpay order
  const razorpayOrder = await razorpay.orders.create({
    amount: amount * 100, // Convert to paise
    currency: currency,
    receipt: `GRY-${orderId}`,
    payment_capture: 1 // Auto-capture
  });
  
  // Save to database
  await supabase.rpc('create_razorpay_order', {
    p_order_id: orderId,
    p_razorpay_order_id: razorpayOrder.id
  });
  
  return new Response(JSON.stringify(razorpayOrder), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### B. Frontend Payment Checkout

```typescript
// FreeAgent checkout page
import { useRazorpay } from 'react-razorpay';

export default function CheckoutPage() {
  const { Razorpay } = useRazorpay();
  
  const handlePayment = async () => {
    // 1. Create order on backend
    const { data: order } = await fetch('/api/create-order', {
      method: 'POST',
      body: JSON.stringify({ gigId, amount: 5000 })
    }).then(r => r.json());
    
    // 2. Open Razorpay checkout
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      order_id: order.razorpay_order_id,
      name: 'Greyin - FreeAgent',
      description: 'Gig Order Payment',
      image: '/logo.png',
      handler: async (response) => {
        // 3. Verify payment on backend
        await fetch('/api/verify-payment', {
          method: 'POST',
          body: JSON.stringify({
            orderId: order.id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature
          })
        });
        
        // 4. Redirect to success page
        router.push(`/orders/${order.id}/success`);
      },
      prefill: {
        name: user.full_name,
        email: user.email,
        contact: user.phone
      },
      theme: {
        color: '#2563eb'
      }
    };
    
    const razorpayInstance = new Razorpay(options);
    razorpayInstance.open();
  };
  
  return (
    <button onClick={handlePayment}>
      Pay ₹5,000
    </button>
  );
}
```

### C. Verify Payment (Backend)

```javascript
// Supabase Edge Function: verify-razorpay-payment
import crypto from 'crypto';

Deno.serve(async (req) => {
  const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = await req.json();
  
  // 1. Verify signature
  const text = razorpayOrderId + '|' + razorpayPaymentId;
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
  const generated_signature = crypto
    .createHmac('sha256', secret)
    .update(text)
    .digest('hex');
  
  if (generated_signature !== razorpaySignature) {
    return new Response('Invalid signature', { status: 400 });
  }
  
  // 2. Capture payment in database
  await supabase.rpc('capture_razorpay_payment', {
    p_order_id: orderId,
    p_payment_id: razorpayPaymentId,
    p_signature: razorpaySignature,
    p_payment_method: null // Will be updated from webhook
  });
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### D. Webhook Handler (Backend)

```javascript
// Supabase Edge Function: razorpay-webhook
import crypto from 'crypto';

Deno.serve(async (req) => {
  const signature = req.headers.get('x-razorpay-signature');
  const body = await req.text();
  
  // 1. Verify webhook signature
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  const signatureVerified = signature === expectedSignature;
  const event = JSON.parse(body);
  
  // 2. Log webhook
  await supabase.from('razorpay_webhooks').insert({
    event_id: event.event,
    event_type: event.event,
    razorpay_order_id: event.payload.order?.entity?.id,
    razorpay_payment_id: event.payload.payment?.entity?.id,
    payload: event,
    signature: signature,
    signature_verified: signatureVerified
  });
  
  // 3. Process event
  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    
    // Find order by razorpay_order_id
    const { data: orders } = await supabase
      .from('gig_orders')
      .select('id')
      .eq('razorpay_order_id', payment.order_id)
      .single();
    
    if (orders) {
      await supabase.rpc('capture_razorpay_payment', {
        p_order_id: orders.id,
        p_payment_id: payment.id,
        p_signature: signature,
        p_payment_method: payment.method
      });
    }
  }
  
  return new Response('OK', { status: 200 });
});
```

---

## 5. Refund Handling

### Automatic Refund (Order Cancelled)

```javascript
// When order is cancelled, initiate refund
const razorpay = new Razorpay({
  key_id: Deno.env.get('RAZORPAY_KEY_ID'),
  key_secret: Deno.env.get('RAZORPAY_KEY_SECRET')
});

// Get payment ID from order
const { data: order } = await supabase
  .from('gig_orders')
  .select('razorpay_payment_id, amount')
  .eq('id', orderId)
  .single();

// Create refund
const refund = await razorpay.payments.refund(order.razorpay_payment_id, {
  amount: order.amount * 100, // Full refund
  speed: 'normal' // or 'optimum' for instant
});

// Update database
await supabase.rpc('process_razorpay_refund', {
  p_order_id: orderId,
  p_refund_id: refund.id,
  p_refund_amount: refund.amount
});
```

---

## 6. Payout to Freelancers (Route/Split Payments)

### Option A: Razorpay Route (Recommended for 0% Commission)

**Setup:**
1. Enable **Razorpay Route** in dashboard
2. Freelancers link their bank accounts via Route Onboarding
3. Payments automatically split/routed

**Implementation:**
```javascript
// When creating order, add transfers
const order = await razorpay.orders.create({
  amount: 5000 * 100,
  currency: 'INR',
  receipt: `GRY-${orderId}`,
  transfers: [
    {
      account: freelancer.razorpay_account_id, // Linked account
      amount: 5000 * 100, // Full amount (0% commission)
      currency: 'INR',
      on_hold: 1, // Hold until delivery
      on_hold_until: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    }
  ]
});
```

### Option B: Manual Payouts (Simple)

**Process:**
1. Client pays → Funds in platform account
2. Freelancer delivers → Admin releases payment
3. Manual payout via Razorpay dashboard or API

---

## 7. Testing

### Test Cards (Razorpay Sandbox)

| Card Number | CVV | Expiry | Result |
|-------------|-----|--------|--------|
| 4111 1111 1111 1111 | Any | Future | Success |
| 4000 0000 0000 0002 | Any | Future | Declined |
| 5555 5555 5555 4444 | Any | Future | Success (Mastercard) |

### Test UPI: `success@razorpay`

### Test Flow:

```bash
# 1. Create test order
curl -X POST https://api.greyin.net/functions/v1/create-razorpay-order \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -d '{"orderId": "uuid-here", "amount": 5000}'

# 2. Use Razorpay checkout with test key
# 3. Verify payment received
# 4. Check database updated
```

---

## 8. Security Best Practices

✅ **Never expose secret key** - Keep in backend only  
✅ **Always verify signatures** - For payments AND webhooks  
✅ **Use HTTPS only** - All Razorpay communication encrypted  
✅ **Log all webhooks** - For audit trail  
✅ **Validate amounts** - Server-side verification  
✅ **Rate limit API** - Prevent abuse  
✅ **PCI compliance** - Razorpay is PCI-DSS certified, never store card data  

---

## 9. Production Checklist

- [ ] Razorpay KYC completed
- [ ] Live API keys generated
- [ ] Webhook URL configured in Razorpay dashboard
- [ ] Webhook secret added to `.env`
- [ ] Migration `002_razorpay_integration.sql` executed
- [ ] Frontend rebuilt with `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- [ ] Test payment flow in production
- [ ] Verify webhook events received
- [ ] Configure payout account (bank details)
- [ ] Enable Route for direct freelancer payouts
- [ ] Set up refund policy
- [ ] Test refund flow
- [ ] Monitor first 10 transactions

---

## 10. Monitoring & Analytics

### Payment Dashboard (Supabase Studio)

```sql
-- View payment analytics
SELECT * FROM public.payment_analytics
ORDER BY date DESC
LIMIT 30;

-- Check pending payments
SELECT id, razorpay_order_id, amount, payment_status, created_at
FROM public.gig_orders
WHERE payment_status = 'pending'
ORDER BY created_at DESC;

-- Recent webhooks
SELECT event_type, signature_verified, processed, created_at
FROM public.razorpay_webhooks
ORDER BY created_at DESC
LIMIT 20;
```

### Razorpay Dashboard Metrics

- Daily transaction volume
- Success rate
- Payment methods breakdown
- Failed payment reasons
- Settlement reports

---

## 11. Support & Documentation

**Razorpay Resources:**
- API Docs: https://razorpay.com/docs/api/
- Integration Guide: https://razorpay.com/docs/payments/
- Route/Split Payments: https://razorpay.com/docs/route/
- Webhooks: https://razorpay.com/docs/webhooks/
- Support: support@razorpay.com

**Greyin Platform Support:**
- Admin Email: admin@greyin.net
- Database: https://studio.greyin.net
- API: https://api.greyin.net

---

## 12. Cost Structure (Razorpay Pricing)

| Payment Method | Razorpay Fee | Platform Fee | Freelancer Gets |
|----------------|--------------|--------------|-----------------|
| Cards (Domestic) | 2% | 0% | ₹4,900 (on ₹5,000) |
| UPI | 0% | 0% | ₹5,000 (full) |
| NetBanking | 2% | 0% | ₹4,900 (on ₹5,000) |
| Wallets | 2% | 0% | ₹4,900 (on ₹5,000) |

**Note:** Razorpay fees are deducted from settlement, not added to customer price.

---

**Implementation Status:** ✅ Schema Ready | ⏳ Code Integration Pending  
**Next Step:** Add Razorpay API keys and run migration
