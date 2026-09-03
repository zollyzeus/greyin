-- ============================================================
-- Order Tracking Enhancements
-- ============================================================
--
-- Adds additional timestamp columns for order lifecycle tracking
-- and renames columns to match payment integration naming
--
-- Run this after 002_razorpay_integration.sql
-- ============================================================

-- Rename columns for consistency with payment integration
ALTER TABLE public.gig_orders 
  RENAME COLUMN client_id TO buyer_id;

ALTER TABLE public.gig_orders 
  RENAME COLUMN freelancer_id TO seller_id;

-- Add additional tracking columns if they don't exist
DO $$ 
BEGIN
  -- Add started_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gig_orders' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE public.gig_orders ADD COLUMN started_at TIMESTAMPTZ;
  END IF;

  -- Add paid_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gig_orders' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE public.gig_orders ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;

  -- Add cancelled_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gig_orders' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE public.gig_orders ADD COLUMN cancelled_at TIMESTAMPTZ;
  END IF;

  -- Add deliverables JSONB column for storing file metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gig_orders' AND column_name = 'deliverables'
  ) THEN
    ALTER TABLE public.gig_orders ADD COLUMN deliverables JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Add package_type column for storing selected package
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gig_orders' AND column_name = 'package_type'
  ) THEN
    ALTER TABLE public.gig_orders ADD COLUMN package_type TEXT CHECK (package_type IN ('basic', 'standard', 'premium'));
  END IF;
END $$;

-- Update status check constraint to include new statuses
ALTER TABLE public.gig_orders DROP CONSTRAINT IF EXISTS gig_orders_status_check;
ALTER TABLE public.gig_orders 
  ADD CONSTRAINT gig_orders_status_check 
  CHECK (status IN ('pending', 'paid', 'authorized', 'in_progress', 'delivered', 'revision_requested', 'completed', 'cancelled', 'disputed', 'refunded', 'failed'));

-- Add comments
COMMENT ON COLUMN public.gig_orders.started_at IS 'Timestamp when seller marked order as in progress';
COMMENT ON COLUMN public.gig_orders.paid_at IS 'Timestamp when payment was captured successfully';
COMMENT ON COLUMN public.gig_orders.cancelled_at IS 'Timestamp when order was cancelled';
COMMENT ON COLUMN public.gig_orders.deliverables IS 'JSONB array of deliverable files with metadata';
COMMENT ON COLUMN public.gig_orders.package_type IS 'Selected package tier (basic, standard, premium)';

-- Update RLS policies to use new column names
DROP POLICY IF EXISTS "Clients can view their orders" ON public.gig_orders;
DROP POLICY IF EXISTS "Freelancers can view their orders" ON public.gig_orders;
DROP POLICY IF EXISTS "Clients can create orders" ON public.gig_orders;

CREATE POLICY "Buyers can view their orders"
  ON public.gig_orders FOR SELECT
  USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view their orders"
  ON public.gig_orders FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Buyers can create orders"
  ON public.gig_orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can update their orders"
  ON public.gig_orders FOR UPDATE
  USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can update orders they are selling"
  ON public.gig_orders FOR UPDATE
  USING (auth.uid() = seller_id);

-- ============================================================
-- Storage bucket for deliverables
-- ============================================================

-- Create storage bucket for order deliverables
INSERT INTO storage.buckets (id, name, public) 
VALUES ('deliverables', 'deliverables', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for deliverables
CREATE POLICY "Users can upload deliverables for their orders"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'deliverables' 
    AND auth.uid() IN (
      SELECT seller_id FROM public.gig_orders 
      WHERE id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Order parties can view deliverables"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'deliverables'
    AND auth.uid() IN (
      SELECT UNNEST(ARRAY[buyer_id, seller_id]) FROM public.gig_orders 
      WHERE id::text = (storage.foldername(name))[1]
    )
  );

-- ============================================================
-- Helper Functions
-- ============================================================

-- Function to check if user is buyer of an order
CREATE OR REPLACE FUNCTION is_order_buyer(order_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.gig_orders
    WHERE id = order_id AND buyer_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is seller of an order
CREATE OR REPLACE FUNCTION is_order_seller(order_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.gig_orders
    WHERE id = order_id AND seller_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Indexes for Performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_gig_orders_buyer_id ON public.gig_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_gig_orders_seller_id ON public.gig_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_gig_orders_status ON public.gig_orders(status);
CREATE INDEX IF NOT EXISTS idx_gig_orders_razorpay_order_id ON public.gig_orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_gig_orders_razorpay_payment_id ON public.gig_orders(razorpay_payment_id);
