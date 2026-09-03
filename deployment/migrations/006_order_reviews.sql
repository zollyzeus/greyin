-- ============================================================
-- Order Review System
-- ============================================================
--
-- Adds review and rating functionality for completed orders
--
-- Run this after 005_order_messaging.sql
-- ============================================================

-- Create order_reviews table
CREATE TABLE IF NOT EXISTS public.order_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.gig_orders ON DELETE CASCADE NOT NULL UNIQUE,
  gig_id UUID REFERENCES public.gigs ON DELETE SET NULL NOT NULL,
  reviewer_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  reviewee_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  helpful_count INTEGER DEFAULT 0,
  response TEXT,
  response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE public.order_reviews IS 'Reviews and ratings for completed orders';
COMMENT ON COLUMN public.order_reviews.order_id IS 'Reference to the order (unique - one review per order)';
COMMENT ON COLUMN public.order_reviews.gig_id IS 'Reference to the gig being reviewed';
COMMENT ON COLUMN public.order_reviews.reviewer_id IS 'User who wrote the review (buyer)';
COMMENT ON COLUMN public.order_reviews.reviewee_id IS 'User being reviewed (seller)';
COMMENT ON COLUMN public.order_reviews.rating IS 'Star rating from 1 to 5';
COMMENT ON COLUMN public.order_reviews.review_text IS 'Review content';
COMMENT ON COLUMN public.order_reviews.helpful_count IS 'Number of users who found this review helpful';
COMMENT ON COLUMN public.order_reviews.response IS 'Seller response to the review';
COMMENT ON COLUMN public.order_reviews.response_at IS 'When seller responded';

-- Enable RLS
ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_reviews
-- Everyone can view reviews
CREATE POLICY "Reviews are publicly viewable"
  ON public.order_reviews FOR SELECT
  USING (true);

-- Only buyers can create reviews for their completed orders
CREATE POLICY "Buyers can create reviews for their orders"
  ON public.order_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.gig_orders
      WHERE id = order_id
        AND buyer_id = auth.uid()
        AND status = 'completed'
    )
  );

-- Reviewers can update their own reviews
CREATE POLICY "Users can update their own reviews"
  ON public.order_reviews FOR UPDATE
  USING (auth.uid() = reviewer_id);

-- Sellers can respond to reviews about them
CREATE POLICY "Sellers can respond to reviews"
  ON public.order_reviews FOR UPDATE
  USING (
    auth.uid() = reviewee_id
    AND response IS NULL
  )
  WITH CHECK (
    auth.uid() = reviewee_id
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_reviews_gig_id ON public.order_reviews(gig_id);
CREATE INDEX IF NOT EXISTS idx_order_reviews_reviewer_id ON public.order_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_order_reviews_reviewee_id ON public.order_reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_order_reviews_rating ON public.order_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_order_reviews_created_at ON public.order_reviews(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER order_reviews_updated_at
  BEFORE UPDATE ON public.order_reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add review stats to gigs table
ALTER TABLE public.gigs 
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.00;

COMMENT ON COLUMN public.gigs.review_count IS 'Total number of reviews for this gig';
COMMENT ON COLUMN public.gigs.average_rating IS 'Average star rating (1.00 to 5.00)';

-- Function to update gig review stats
CREATE OR REPLACE FUNCTION update_gig_review_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_gig_id UUID;
BEGIN
  -- Get gig_id from the review
  IF TG_OP = 'DELETE' THEN
    v_gig_id := OLD.gig_id;
  ELSE
    v_gig_id := NEW.gig_id;
  END IF;

  -- Update gig stats
  UPDATE public.gigs
  SET 
    review_count = (
      SELECT COUNT(*) FROM public.order_reviews WHERE gig_id = v_gig_id
    ),
    average_rating = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0.00)
      FROM public.order_reviews 
      WHERE gig_id = v_gig_id
    )
  WHERE id = v_gig_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update gig stats when review is created/updated/deleted
CREATE TRIGGER update_gig_review_stats_trigger
  AFTER INSERT OR UPDATE OF rating OR DELETE ON public.order_reviews
  FOR EACH ROW EXECUTE FUNCTION update_gig_review_stats();

-- Add seller rating stats to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_rating DECIMAL(3,2) DEFAULT 0.00;

COMMENT ON COLUMN public.profiles.total_reviews IS 'Total number of reviews received as a seller';
COMMENT ON COLUMN public.profiles.seller_rating IS 'Average rating as a seller (1.00 to 5.00)';

-- Function to update seller review stats
CREATE OR REPLACE FUNCTION update_seller_review_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_reviewee_id UUID;
BEGIN
  -- Get reviewee_id from the review
  IF TG_OP = 'DELETE' THEN
    v_reviewee_id := OLD.reviewee_id;
  ELSE
    v_reviewee_id := NEW.reviewee_id;
  END IF;

  -- Update seller stats
  UPDATE public.profiles
  SET 
    total_reviews = (
      SELECT COUNT(*) FROM public.order_reviews WHERE reviewee_id = v_reviewee_id
    ),
    seller_rating = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0.00)
      FROM public.order_reviews 
      WHERE reviewee_id = v_reviewee_id
    )
  WHERE id = v_reviewee_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update seller stats when review is created/updated/deleted
CREATE TRIGGER update_seller_review_stats_trigger
  AFTER INSERT OR UPDATE OF rating OR DELETE ON public.order_reviews
  FOR EACH ROW EXECUTE FUNCTION update_seller_review_stats();

-- View for gig reviews with reviewer info
CREATE OR REPLACE VIEW gig_reviews_view AS
SELECT 
  r.*,
  p.full_name as reviewer_name,
  p.avatar_url as reviewer_avatar,
  o.package_type,
  g.title as gig_title
FROM public.order_reviews r
JOIN public.profiles p ON r.reviewer_id = p.id
JOIN public.gig_orders o ON r.order_id = o.id
JOIN public.gigs g ON r.gig_id = g.id
ORDER BY r.created_at DESC;
