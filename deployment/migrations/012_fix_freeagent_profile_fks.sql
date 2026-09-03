-- ============================================================
-- Fix FreeAgent messaging/review FK targets so PostgREST can
-- embed profiles
-- ============================================================
--
-- order_messages.sender_id and order_reviews.reviewer_id/reviewee_id were
-- defined referencing auth.users, but the chat and review UI both embed
-- `profiles!sender_id(...)` / `profiles!reviewer_id(...)` /
-- `profiles!reviewee_id(...)`, which PostgREST can only resolve via a real
-- foreign key to that specific table. Every one of those queries errored
-- out entirely, which is why order chat and reviews never worked.
--
-- gig_orders.buyer_id/seller_id and gigs.freelancer_id already correctly
-- reference profiles (from earlier migrations), so this brings the other
-- two tables in line with that same, correct pattern.
--
-- Run this after 011_fix_saltnpepper_profile_fks.sql
-- ============================================================

ALTER TABLE public.order_messages
  DROP CONSTRAINT order_messages_sender_id_fkey,
  ADD CONSTRAINT order_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.order_reviews
  DROP CONSTRAINT order_reviews_reviewer_id_fkey,
  ADD CONSTRAINT order_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.order_reviews
  DROP CONSTRAINT order_reviews_reviewee_id_fkey,
  ADD CONSTRAINT order_reviews_reviewee_id_fkey FOREIGN KEY (reviewee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
