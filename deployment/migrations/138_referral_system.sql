-- ============================================================
-- Platform-wide referral growth loop (Hub-hosted, no pillar affiliation)
-- ============================================================
--
-- Greyin's only prior "referral" feature (apps/deepedge/.../jobs/[id]/
-- refer/route.ts, 040/077) is a narrow, unrelated thing -- refer ONE
-- specific job posting to ONE email, no code, no tracking, no reward.
-- This is additive, separate, and platform-wide: every user gets one
-- permanent shareable code; anyone who redeems it (once, ever) counts as
-- a real conversion for the referrer.
--
-- Two tables, not one -- a single referrer's code can be redeemed by
-- MANY different people (a real "share this link anywhere" referral
-- program, not a one-time single-invite code), so "code" and
-- "redemption" are naturally separate rows, not a status flag on one
-- row that can only ever describe one invitee.
--
-- No reward mechanism lives here: a flat bonus is architecturally
-- impossible to write into greyin_scores directly (036, a VIEW computed
-- live from evidence tables, no INSERT path at all) -- redeem_referral_code()
-- below calls the EXISTING award_reputation() (025) instead, which
-- already flows into greyin_scores through its established
-- reputation_events evidence channel. This is the only correct place a
-- referral reward can enter the score at all.
--
-- Run this after 137_demo_login_rate_limit_action.sql
-- ============================================================

CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "A user can see their own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = referrer_id);

-- No INSERT/UPDATE/DELETE policy at all -- the only write path is
-- create_referral_code() below (SECURITY DEFINER), same "no direct
-- client write" convention as rate_limit_attempts (075).

-- redeemed_by is UNIQUE: a person can be referred at most once, ever
-- (whichever code they redeem first), which is what blocks both
-- double-redemption and (combined with the self-referral check in the
-- function below) self-referral in one simple constraint.
CREATE TABLE public.referral_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_code_id UUID NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_by UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_redemptions_referrer ON public.referral_redemptions(referrer_id);

ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "A user can see redemptions they made or received"
  ON public.referral_redemptions FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = redeemed_by);

-- Idempotent "get or create" -- one persistent code per person, not a
-- new one minted every dashboard visit. Code is derived from a fresh
-- UUID via the built-in gen_random_uuid() (NOT uuid_generate_v4() --
-- that lives in the `extensions` schema per 001's CREATE EXTENSION,
-- unreachable from a SECURITY DEFINER function whose search_path is
-- locked to `public` only; confirmed live via PostgREST returning
-- "function uuid_generate_v4() does not exist" on first deploy of this
-- function -- gen_random_uuid() is a pg_catalog built-in, always
-- reachable regardless of search_path), truncated to 8 uppercase hex
-- chars; collision odds at this table's realistic scale are negligible
-- and the UNIQUE constraint is the real backstop either way.
CREATE OR REPLACE FUNCTION public.create_referral_code()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT code INTO v_code FROM referral_codes WHERE referrer_id = auth.uid();
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO referral_codes (referrer_id, code) VALUES (auth.uid(), v_code);
  RETURN v_code;
END;
$$;

-- Validates + records a redemption, blocks self-referral and
-- double-redemption (the latter via redeemed_by's own UNIQUE
-- constraint -- caught here first for a clean error message rather than
-- surfacing a raw constraint-violation to the caller), enforces the
-- 4-conversion cap on the REFERRER before awarding, then reuses the
-- existing award_reputation() (025) -- +25 points, event_type
-- 'referral_converted' -- which flows into greyin_scores automatically.
CREATE OR REPLACE FUNCTION public.redeem_referral_code(p_code TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referral_code_id UUID;
  v_referrer_id UUID;
  v_conversion_count INTEGER;
BEGIN
  SELECT id, referrer_id INTO v_referral_code_id, v_referrer_id
  FROM referral_codes WHERE code = upper(p_code);

  IF v_referral_code_id IS NULL THEN
    RAISE EXCEPTION 'Invalid referral code';
  END IF;

  IF v_referrer_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot redeem your own referral code';
  END IF;

  IF EXISTS (SELECT 1 FROM referral_redemptions WHERE redeemed_by = auth.uid()) THEN
    RAISE EXCEPTION 'You have already been referred';
  END IF;

  SELECT count(*) INTO v_conversion_count
  FROM reputation_events
  WHERE user_id = v_referrer_id AND event_type = 'referral_converted';

  IF v_conversion_count >= 4 THEN
    RAISE EXCEPTION 'This referrer has reached the maximum number of rewarded referrals';
  END IF;

  INSERT INTO referral_redemptions (referral_code_id, referrer_id, redeemed_by)
  VALUES (v_referral_code_id, v_referrer_id, auth.uid());

  PERFORM award_reputation(v_referrer_id, 'referral_converted', 25, v_referral_code_id);
END;
$$;

-- get_referral_stats(): a user's own code + how many people have joined
-- through it -- the read side the dashboard widget renders.
CREATE OR REPLACE FUNCTION public.get_referral_stats()
RETURNS TABLE (code TEXT, joined_count BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT rc.code, count(rr.id)
  FROM referral_codes rc
  LEFT JOIN referral_redemptions rr ON rr.referral_code_id = rc.id
  WHERE rc.referrer_id = auth.uid()
  GROUP BY rc.code;
$$;

GRANT EXECUTE ON FUNCTION public.create_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';
