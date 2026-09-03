-- ============================================================
-- Fix: DeepEdge candidate search building a URL-length-unsafe query
-- ============================================================
--
-- apps/deepedge/src/app/candidates/page.tsx computed the verified-expert
-- id list client-side (one query against greyin_scores) and then filtered
-- public.candidates with `.in('user_id', <that list>)`. supabase-js sends
-- that filter as a GET query string, so the id list is embedded directly
-- in the request URL. At 243 verified experts (the real number once this
-- session's seeding raised platform headcount, but headcount was already
-- most of the way there from stackworks' 183 pillar members alone -- this
-- was going to break for a real reason, not just seed volume), the
-- generated URL is ~9.1KB, past the 8KB request-line limit -- PostgREST
-- returns 414 URI Too Long, and the page silently renders "No candidates
-- found" for every employer, regardless of how much real candidate data
-- exists. Confirmed live with a direct curl reproduction before writing
-- this fix.
--
-- Fix: move the join server-side into a SQL function, so the client never
-- builds an id list into a URL at all -- this scales to any headcount, not
-- just past today's number. LANGUAGE sql with no SECURITY DEFINER (the
-- default is SECURITY INVOKER) so RLS keeps applying exactly as it does
-- today: public.candidates' own "authenticated users only" SELECT policy
-- still gates every call through this function precisely as it gated the
-- old two-query approach, and public.profiles' policy is `true` (public)
-- either way. No authorization behavior changes, only how the join runs.
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_verified_candidates(
  p_skill text DEFAULT NULL,
  p_min_experience int DEFAULT NULL,
  p_availability text DEFAULT NULL,
  p_remote_preference text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  current_title text,
  skills text[],
  experience_years int,
  availability text,
  remote_preference text,
  greyin_score numeric,
  full_name text,
  location text,
  avatar_url text,
  is_reentry boolean,
  reentry_reason text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.user_id,
    c.current_title,
    c.skills,
    c.experience_years,
    c.availability,
    c.remote_preference,
    gs.greyin_score,
    p.full_name,
    p.location,
    p.avatar_url,
    p.is_reentry,
    p.reentry_reason
  FROM public.candidates c
  JOIN public.greyin_scores gs ON gs.user_id = c.user_id
  JOIN public.profiles p ON p.id = c.user_id
  WHERE gs.is_verified_expert = true
    AND COALESCE(p.is_pivoter, false) = false
    AND (p_skill IS NULL OR c.skills @> ARRAY[p_skill])
    AND (p_min_experience IS NULL OR c.experience_years >= p_min_experience)
    AND (p_availability IS NULL OR c.availability = p_availability)
    AND (p_remote_preference IS NULL OR c.remote_preference = p_remote_preference)
  ORDER BY c.created_at DESC
  LIMIT 50
$$;

GRANT EXECUTE ON FUNCTION public.search_verified_candidates TO authenticated;
