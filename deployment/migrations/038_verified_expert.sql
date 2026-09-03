-- ============================================================
-- Verified Expert: the single shared eligibility gate
-- ============================================================
--
-- Restores the original business plan's core thesis (an age-blind
-- network for 12+-years professionals, funded by employer placement
-- fees) after it drifted: Greyin B2B had no experience gate at all,
-- FreeAgent had no gate either (despite being meant for the same
-- population as Salt & Pepper), and GreyMatters granted authorship to
-- every signup unconditionally.
--
-- is_verified_expert = years_experience >= 12 OR greyin_score >= 75.
-- Computed once here (same derived-eligibility pattern as Prolab's
-- isBuilder() in apps/prolab/src/lib/prolab-role.ts) and reused by
-- every app's RLS/route logic, rather than each app repeating its own
-- threshold. This is what lets someone without 12 years on paper earn
-- Greyin B2B candidacy or GreyMatters authorship through a strong
-- cross-platform track record instead -- the flywheel the plan
-- describes, made mechanically real via the Greyin Score (036).
--
-- Run this after 037_ecosystem_search_full_coverage.sql
-- ============================================================

CREATE OR REPLACE VIEW public.greyin_scores AS
WITH constants AS (
  SELECT 3 AS m_prolab, 5 AS m_freeagent, 10 AS m_saltnpepper
),
prolab_raw AS (
  SELECT subject_user_id AS user_id, AVG(score)::numeric AS raw, COUNT(*) AS v
  FROM public.verified_outcomes
  WHERE status = 'verified'
  GROUP BY subject_user_id
),
freeagent_raw AS (
  SELECT id AS user_id, (seller_rating / 5.0 * 100)::numeric AS raw, total_reviews AS v
  FROM public.profiles
  WHERE total_reviews > 0
),
saltnpepper_raw AS (
  SELECT user_id, (LEAST(SUM(points), 100)::numeric / 100 * 100) AS raw, COUNT(*) AS v
  FROM public.reputation_events
  GROUP BY user_id
),
platform_stats AS (
  SELECT
    (SELECT AVG(raw) FROM prolab_raw) AS prolab_mean,
    (SELECT COUNT(*) FROM prolab_raw) AS prolab_headcount,
    (SELECT AVG(raw) FROM freeagent_raw) AS freeagent_mean,
    (SELECT COUNT(*) FROM freeagent_raw) AS freeagent_headcount,
    (SELECT AVG(raw) FROM saltnpepper_raw) AS saltnpepper_mean,
    (SELECT COUNT(*) FROM saltnpepper_raw) AS saltnpepper_headcount
),
per_user AS (
  SELECT
    p.id AS user_id,
    p.years_experience,
    pr.v AS prolab_evidence,
    pr.raw AS prolab_raw,
    CASE WHEN pr.v IS NOT NULL THEN
      ROUND((pr.v::numeric / (pr.v + c.m_prolab)) * pr.raw + (c.m_prolab::numeric / (pr.v + c.m_prolab)) * s.prolab_mean)
    END AS prolab_score,
    fa.v AS freeagent_evidence,
    fa.raw AS freeagent_raw,
    CASE WHEN fa.v IS NOT NULL THEN
      ROUND((fa.v::numeric / (fa.v + c.m_freeagent)) * fa.raw + (c.m_freeagent::numeric / (fa.v + c.m_freeagent)) * s.freeagent_mean)
    END AS freeagent_score,
    sp.v AS saltnpepper_evidence,
    sp.raw AS saltnpepper_raw,
    CASE WHEN sp.v IS NOT NULL THEN
      ROUND((sp.v::numeric / (sp.v + c.m_saltnpepper)) * sp.raw + (c.m_saltnpepper::numeric / (sp.v + c.m_saltnpepper)) * s.saltnpepper_mean)
    END AS saltnpepper_score,
    s.prolab_headcount, s.freeagent_headcount, s.saltnpepper_headcount
  FROM public.profiles p
  CROSS JOIN constants c
  CROSS JOIN platform_stats s
  LEFT JOIN prolab_raw pr ON pr.user_id = p.id
  LEFT JOIN freeagent_raw fa ON fa.user_id = p.id
  LEFT JOIN saltnpepper_raw sp ON sp.user_id = p.id
),
scored AS (
  SELECT
    user_id,
    prolab_score, prolab_evidence, prolab_headcount,
    freeagent_score, freeagent_evidence, freeagent_headcount,
    saltnpepper_score, saltnpepper_evidence, saltnpepper_headcount,
    years_experience,
    ROUND(
      (
        COALESCE(prolab_score * LN(prolab_headcount + 1), 0) +
        COALESCE(freeagent_score * LN(freeagent_headcount + 1), 0) +
        COALESCE(saltnpepper_score * LN(saltnpepper_headcount + 1), 0)
      ) / NULLIF(
        (CASE WHEN prolab_score IS NOT NULL THEN LN(prolab_headcount + 1) ELSE 0 END) +
        (CASE WHEN freeagent_score IS NOT NULL THEN LN(freeagent_headcount + 1) ELSE 0 END) +
        (CASE WHEN saltnpepper_score IS NOT NULL THEN LN(saltnpepper_headcount + 1) ELSE 0 END),
        0
      )
    ) AS platform_composite,
    CASE WHEN prolab_score IS NOT NULL OR freeagent_score IS NOT NULL OR saltnpepper_score IS NOT NULL THEN
      ROUND(
        0.85 * (
          (
            COALESCE(prolab_score * LN(prolab_headcount + 1), 0) +
            COALESCE(freeagent_score * LN(freeagent_headcount + 1), 0) +
            COALESCE(saltnpepper_score * LN(saltnpepper_headcount + 1), 0)
          ) / NULLIF(
            (CASE WHEN prolab_score IS NOT NULL THEN LN(prolab_headcount + 1) ELSE 0 END) +
            (CASE WHEN freeagent_score IS NOT NULL THEN LN(freeagent_headcount + 1) ELSE 0 END) +
            (CASE WHEN saltnpepper_score IS NOT NULL THEN LN(saltnpepper_headcount + 1) ELSE 0 END),
            0
          )
        ) + 0.15 * (LEAST(COALESCE(years_experience, 0), 20) / 20.0 * 100)
      )
    END AS greyin_score
  FROM per_user
)
SELECT
  *,
  (COALESCE(years_experience, 0) >= 12 OR COALESCE(greyin_score, 0) >= 75) AS is_verified_expert
FROM scored;

GRANT SELECT ON public.greyin_scores TO anon, authenticated;

-- ------------------------------------------------------------
-- profiles: widen role for 'follower' (GreyMatters' passive tier)
-- ------------------------------------------------------------
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%'
    AND pg_get_constraintdef(oid) NOT LIKE '%prolab_role%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('candidate', 'client', 'freelancer', 'admin', 'author', 'employer', 'member', 'supporter', 'follower'));

-- ------------------------------------------------------------
-- posts: per-post view/comment audience
-- ------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS view_audience TEXT CHECK (view_audience IN ('verified_expert', 'follower', 'public')) DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS comment_audience TEXT CHECK (comment_audience IN ('verified_expert', 'follower', 'public')) DEFAULT 'public';

-- Additive PERMISSIVE policy replacing the old unconditional "published
-- = visible to everyone" rule -- ineligible viewers' SELECT simply
-- returns no rows, which existing app code already treats as not-found.
DROP POLICY IF EXISTS "Published posts are viewable by everyone" ON public.posts;

CREATE POLICY "Published posts respect their view audience"
  ON public.posts FOR SELECT
  USING (
    status = 'published' AND (
      view_audience = 'public'
      OR (view_audience = 'follower' AND auth.role() = 'authenticated')
      OR (view_audience = 'verified_expert' AND EXISTS (
        SELECT 1 FROM public.greyin_scores WHERE user_id = auth.uid() AND is_verified_expert
      ))
    )
  );

-- Authorship becomes earned/derived rather than a single stored role
-- value that would otherwise collide across pillars (a Salt & Pepper
-- member's profiles.role is 'member', not 'author', even though they
-- may well qualify as a verified expert who should be able to publish).
DROP POLICY IF EXISTS "Authors can insert posts" ON public.posts;

CREATE POLICY "Verified experts can insert posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id AND (
      EXISTS (SELECT 1 FROM public.greyin_scores WHERE user_id = auth.uid() AND is_verified_expert)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- ------------------------------------------------------------
-- comments: respect the parent post's comment_audience
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Approved comments viewable by everyone" ON public.comments;

CREATE POLICY "Approved comments respect their post's comment audience"
  ON public.comments FOR SELECT
  USING (
    status = 'approved' AND EXISTS (
      SELECT 1 FROM public.posts p WHERE p.id = comments.post_id AND (
        p.comment_audience = 'public'
        OR (p.comment_audience = 'follower' AND auth.role() = 'authenticated')
        OR (p.comment_audience = 'verified_expert' AND EXISTS (
          SELECT 1 FROM public.greyin_scores WHERE user_id = auth.uid() AND is_verified_expert
        ))
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert comments" ON public.comments;

CREATE POLICY "Comments respect their post's comment audience"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.posts p WHERE p.id = comments.post_id AND (
        p.comment_audience = 'public'
        OR (p.comment_audience = 'follower' AND auth.role() = 'authenticated')
        OR (p.comment_audience = 'verified_expert' AND EXISTS (
          SELECT 1 FROM public.greyin_scores WHERE user_id = auth.uid() AND is_verified_expert
        ))
      )
    )
  );

-- ------------------------------------------------------------
-- handle_email_confirmed(): seed candidates.experience_years too
-- ------------------------------------------------------------
-- Same function as 030's version, plus: copy years_experience into the
-- new candidates row so a fresh candidate's professional profile isn't
-- blank (was previously only written to profiles.years_experience).
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  meta JSONB := NEW.raw_user_meta_data;
  user_role TEXT := COALESCE(meta->>'role', 'candidate');
  full_name TEXT := trim(concat(meta->>'first_name', ' ', meta->>'last_name'));
  v_pillar TEXT;
  v_prolab_role TEXT := meta->>'prolab_role';
  v_years_experience INTEGER := NULLIF(meta->>'years_experience', '')::INTEGER;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, years_experience, prolab_role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(full_name, ''),
    user_role,
    v_years_experience,
    v_prolab_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role = EXCLUDED.role,
    years_experience = COALESCE(EXCLUDED.years_experience, public.profiles.years_experience),
    prolab_role = COALESCE(EXCLUDED.prolab_role, public.profiles.prolab_role),
    updated_at = NOW();

  IF user_role = 'employer' THEN
    INSERT INTO public.companies (user_id, name, slug)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(full_name, ''), NEW.email) || '''s Company',
      'company-' || substr(NEW.id::text, 1, 8)
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF user_role = 'candidate' THEN
    INSERT INTO public.candidates (user_id, experience_years)
    VALUES (NEW.id, v_years_experience)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  v_pillar := CASE
    WHEN user_role IN ('candidate', 'employer') THEN 'greyin'
    WHEN user_role IN ('client', 'freelancer') THEN 'freeagent'
    WHEN user_role = 'member' THEN 'saltnpepper'
    WHEN user_role IN ('author', 'follower') THEN 'greymatters'
  END;
  IF v_pillar IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, v_pillar, user_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  IF v_prolab_role IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, 'prolab', v_prolab_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
