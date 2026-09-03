-- ============================================================
-- Razorpay Payment Integration
-- ============================================================
-- 
-- Adds Razorpay-specific payment tracking fields to support:
--   - Order creation and payment links
--   - Payment capture and verification
--   - Refunds and disputes
--   - Webhooks for payment status updates
--
-- Run this after 001_initial_schema.sql
-- ============================================================

-- Add Razorpay payment fields to gig_orders
ALTER TABLE public.gig_orders
  ADD COLUMN razorpay_order_id TEXT,
  ADD COLUMN razorpay_payment_id TEXT,
  ADD COLUMN razorpay_signature TEXT,
  ADD COLUMN payment_status TEXT CHECK (payment_status IN ('pending', 'authorized', 'captured', 'failed', 'refunded')) DEFAULT 'pending',
  ADD COLUMN payment_method TEXT,
  ADD COLUMN payment_captured_at TIMESTAMPTZ,
  ADD COLUMN refund_id TEXT,
  ADD COLUMN refund_amount INTEGER,
  ADD COLUMN refund_status TEXT CHECK (refund_status IN ('pending', 'processed', 'failed')),
  ADD COLUMN refunded_at TIMESTAMPTZ,
  ADD COLUMN payment_error_code TEXT,
  ADD COLUMN payment_error_description TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.gig_orders.razorpay_order_id IS 'Razorpay order ID (order_xxxxx)';
COMMENT ON COLUMN public.gig_orders.razorpay_payment_id IS 'Razorpay payment ID after successful payment (pay_xxxxx)';
COMMENT ON COLUMN public.gig_orders.razorpay_signature IS 'HMAC signature for payment verification';
COMMENT ON COLUMN public.gig_orders.payment_status IS 'Payment lifecycle status';
COMMENT ON COLUMN public.gig_orders.payment_method IS 'Payment method used (card, netbanking, upi, wallet)';

-- ============================================================
-- Payment Webhooks Log
-- ============================================================
-- Track all Razorpay webhook events for audit and debugging

CREATE TABLE public.razorpay_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  order_id UUID REFERENCES public.gig_orders ON DELETE SET NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  payload JSONB NOT NULL,
  signature TEXT,
  signature_verified BOOLEAN DEFAULT false,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.razorpay_webhooks ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook logs
CREATE POLICY "Admins can view webhooks"
  ON public.razorpay_webhooks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE public.razorpay_webhooks IS 'Audit log for all Razorpay webhook events';

-- ============================================================
-- Payment Analytics View
-- ============================================================
-- Aggregated view for payment metrics and reporting

CREATE VIEW public.payment_analytics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN payment_status = 'captured' THEN 1 END) as successful_payments,
  COUNT(CASE WHEN payment_status = 'failed' THEN 1 END) as failed_payments,
  SUM(CASE WHEN payment_status = 'captured' THEN amount ELSE 0 END) as total_revenue,
  SUM(CASE WHEN refund_status = 'processed' THEN refund_amount ELSE 0 END) as total_refunds,
  AVG(CASE WHEN payment_status = 'captured' THEN amount END) as avg_order_value
FROM public.gig_orders
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

COMMENT ON VIEW public.payment_analytics IS 'Daily payment metrics for reporting';

-- ============================================================
-- Razorpay Configuration Table
-- ============================================================
-- Store Razorpay settings (keys stored in environment, not DB)

CREATE TABLE public.razorpay_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_secret TEXT NOT NULL, -- For webhook signature verification
  payment_capture_mode TEXT CHECK (payment_capture_mode IN ('automatic', 'manual')) DEFAULT 'automatic',
  currency TEXT DEFAULT 'INR',
  receipt_prefix TEXT DEFAULT 'GRY',
  notes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.razorpay_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage config
CREATE POLICY "Admins can manage razorpay config"
  ON public.razorpay_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default configuration
INSERT INTO public.razorpay_config (webhook_secret, payment_capture_mode, currency, receipt_prefix)
VALUES ('CHANGE_THIS_WEBHOOK_SECRET', 'automatic', 'INR', 'GRY');

COMMENT ON TABLE public.razorpay_config IS 'Razorpay payment gateway configuration';

-- ============================================================
-- Indexes for Performance
-- ============================================================

CREATE INDEX idx_gig_orders_razorpay_order_id ON public.gig_orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX idx_gig_orders_razorpay_payment_id ON public.gig_orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX idx_gig_orders_payment_status ON public.gig_orders(payment_status);
CREATE INDEX idx_razorpay_webhooks_event_id ON public.razorpay_webhooks(event_id);
CREATE INDEX idx_razorpay_webhooks_razorpay_order_id ON public.razorpay_webhooks(razorpay_order_id);
CREATE INDEX idx_razorpay_webhooks_processed ON public.razorpay_webhooks(processed, created_at);

-- ============================================================
-- Functions for Payment Processing
-- ============================================================

-- Function to create Razorpay order
CREATE OR REPLACE FUNCTION public.create_razorpay_order(
  p_order_id UUID,
  p_razorpay_order_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.gig_orders
  SET 
    razorpay_order_id = p_razorpay_order_id,
    payment_status = 'pending',
    updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify and capture payment
CREATE OR REPLACE FUNCTION public.capture_razorpay_payment(
  p_order_id UUID,
  p_payment_id TEXT,
  p_signature TEXT,
  p_payment_method TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.gig_orders
  SET 
    razorpay_payment_id = p_payment_id,
    razorpay_signature = p_signature,
    payment_method = p_payment_method,
    payment_status = 'captured',
    payment_captured_at = NOW(),
    status = 'in_progress',
    updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process refund
CREATE OR REPLACE FUNCTION public.process_razorpay_refund(
  p_order_id UUID,
  p_refund_id TEXT,
  p_refund_amount INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.gig_orders
  SET 
    refund_id = p_refund_id,
    refund_amount = p_refund_amount,
    refund_status = 'processed',
    refunded_at = NOW(),
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Migration Complete
-- ============================================================
