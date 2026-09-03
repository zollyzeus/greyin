-- ============================================================
-- FreeAgent: Upwork-style escrow workflow completion
-- ============================================================
--
-- gig_orders already implements the core of Upwork's fixed-price escrow
-- model: the client's payment is captured upfront and held by the platform
-- (via Razorpay) — it only counts toward the freelancer's withdrawable
-- balance once status = 'completed' (see earnings/page.tsx), and only the
-- buyer can make that transition, and only from 'delivered'
-- (api/orders/update-status/route.ts). What's missing is the rest of
-- Upwork's dispute ladder: a buyer who isn't satisfied with a delivery
-- currently has no option except unilaterally accepting it — there's no
-- "request changes" or "raise a dispute" path, and no refund path at all
-- (process_razorpay_refund from 002_razorpay_integration.sql was defined
-- but never wired to anything). This adds the two text fields the new
-- request-revision and dispute routes need; the 'revision_requested' /
-- 'disputed' / 'cancelled' / 'refunded' status values themselves already
-- exist in gig_orders_status_check from earlier migrations.
-- ============================================================

ALTER TABLE public.gig_orders
  ADD COLUMN IF NOT EXISTS revision_notes TEXT,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

-- Dispute resolution is the one order-status transition neither the buyer
-- nor the seller can be trusted to make unilaterally — an admin needs to
-- both view and update orders they're not a party to (existing SELECT/UPDATE
-- policies are both scoped to auth.uid() IN (buyer_id, seller_id)).
DROP POLICY IF EXISTS "Admins can view all orders" ON public.gig_orders;
CREATE POLICY "Admins can view all orders" ON public.gig_orders
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can update disputed orders" ON public.gig_orders;
CREATE POLICY "Admins can update disputed orders" ON public.gig_orders
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

NOTIFY pgrst, 'reload schema';
