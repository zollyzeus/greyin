-- ============================================================
-- Fix remaining FK targets so PostgREST can embed profiles
-- ============================================================
--
-- Same issue as migrations 011/012, found via a full sweep of every FK
-- pointing at auth.users: comments.user_id, candidates.user_id, and
-- companies.user_id all referenced auth.users instead of public.profiles,
-- breaking `profiles(...)` / `profiles:user_id(...)` embeds in:
--   - GreyMatters post pages (comment display always showed "Comments (0)"
--     even when comments existed, since the whole query errored out)
--   - Greyin B2B /candidates (employer candidate search) and the
--     per-job applications review page (nested profiles embed inside
--     candidates(...))
--
-- Run this after 012_fix_freeagent_profile_fks.sql
-- ============================================================

ALTER TABLE public.comments
  DROP CONSTRAINT comments_user_id_fkey,
  ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.candidates
  DROP CONSTRAINT candidates_user_id_fkey,
  ADD CONSTRAINT candidates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.companies
  DROP CONSTRAINT companies_user_id_fkey,
  ADD CONSTRAINT companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
