-- ============================================================
-- GreyMatters Newsletter Subscribers
-- ============================================================
--
-- Adds a standalone subscribers table for the GreyMatters
-- newsletter signup (does not require an account).
--
-- Run this after 007_profile_role_and_experience.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.newsletter_subscribers IS 'Email addresses subscribed to the GreyMatters newsletter';

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (insert their own email); no read/update access via the API.
CREATE POLICY "Anyone can subscribe to the newsletter"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON public.newsletter_subscribers(email);
