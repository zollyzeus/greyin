-- ============================================================
-- App 1 Tier 3: freeagent -> flexpro, live database objects
-- ============================================================
--
-- Part of the user-directed full internal rename (freeagent->flexpro,
-- stackedge->stackworks, greyin(-b2b)->deepedge) reversing the
-- 2026-09-01 rebrand's original decision to leave internal identifiers
-- on their old codenames. This is App 1's Tier 3 (live data) --
-- deploy the corresponding Tier 2 app-code changes (7 files in
-- apps/flexpro reading/writing freeagent_subscriptions/
-- freeagent_posting/freeagent_pro/freeagent_score etc., plus every
-- sibling app's profile/gig/seller pages selecting greyin_scores'
-- freeagent_* columns) in the SAME deploy as this migration, not
-- before -- shipping this migration first, alone, would make old
-- (not-yet-deployed) app code start failing against a schema that no
-- longer has the literals it queries for.
--
-- Every literal-string-value object below was catalogued by reading
-- every one of the 102 existing migration files for its LATEST
-- authoritative definition (several of these were redefined multiple
-- times across migration history -- e.g. greyin_scores across 036/038/
-- 041/047/048/064/089), then cross-checked against the live database
-- directly (pg_constraint, pg_depend, pg_class.reloptions, and actual
-- row counts) before writing this file, since a migration file's
-- history is not proof of the live schema's current state (089's
-- CREATE OR REPLACE VIEW public.collaborators, for one, silently
-- dropped the security_invoker=true that 067 had set on it -- CREATE
-- OR REPLACE VIEW resets reloptions unless reissued; confirmed live,
-- not reissued here since that's a pre-existing, unrelated finding,
-- not something this rename should silently fix).
--
-- Live row counts confirmed immediately before writing this migration
-- (2026-09-02): pillar_memberships.pillar='freeagent' (1),
-- subscription_plans.tier='freeagent_pro' (1),
-- subscription_tiers.product='freeagent_posting' (3),
-- llm_feature_flags.feature_key IN ('freeagent_delivery_quality',
-- 'freeagent_gig_quality') (2), freeagent_subscriptions (0 rows --
-- no active FlexPro subscriber yet, so its rename carries no data
-- risk), ai_quality_scores.content_type='freeagent_delivery' (0 rows).
--
-- Run this after 102_notifications_realtime.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. freeagent_subscriptions table, its trigger, and its 3
-- freeagent-named admin policies. RLS policies on client_jobs (093)
-- and gigs (094) that reference this table by name in their body are
-- NOT touched -- policy quals are bound to the table's OID at CREATE
-- POLICY time, so a plain rename resolves transparently, same as any
-- FK. Only plpgsql FUNCTION bodies (opaque text, re-resolved by name
-- against search_path on each replan) actually break on a table
-- rename -- see get_active_tier_id() below, the one place that
-- matters.
-- ------------------------------------------------------------
ALTER TABLE public.freeagent_subscriptions RENAME TO flexpro_subscriptions;
ALTER TRIGGER freeagent_subscriptions_updated_at ON public.flexpro_subscriptions RENAME TO flexpro_subscriptions_updated_at;
ALTER POLICY "Admins can view all freeagent subscriptions" ON public.flexpro_subscriptions RENAME TO "Admins can view all flexpro subscriptions";
ALTER POLICY "Admins can manage all freeagent subscriptions" ON public.flexpro_subscriptions RENAME TO "Admins can manage all flexpro subscriptions";
ALTER POLICY "Admins can create freeagent subscriptions" ON public.flexpro_subscriptions RENAME TO "Admins can create flexpro subscriptions";

-- ------------------------------------------------------------
-- 2. handle_email_confirmed() -- fires on every signup, any pillar.
-- 069's exact current body, reproduced byte-for-byte except the one
-- literal this migration exists to change.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  meta JSONB := NEW.raw_user_meta_data;
  user_role TEXT := COALESCE(meta->>'role', 'candidate');
  full_name TEXT := trim(concat(meta->>'first_name', ' ', meta->>'last_name'));
  v_pillar TEXT;
  v_stackedge_role TEXT := meta->>'stackedge_role';
  v_years_experience INTEGER := NULLIF(meta->>'years_experience', '')::INTEGER;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF user_role = 'admin' THEN
    user_role := 'candidate';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, years_experience, stackedge_role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(full_name, ''),
    user_role,
    v_years_experience,
    v_stackedge_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role = EXCLUDED.role,
    years_experience = COALESCE(EXCLUDED.years_experience, public.profiles.years_experience),
    stackedge_role = COALESCE(EXCLUDED.stackedge_role, public.profiles.stackedge_role),
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
    WHEN user_role IN ('client', 'freelancer') THEN 'flexpro'
    WHEN user_role = 'member' THEN 'saltnpepper'
    WHEN user_role IN ('author', 'follower') THEN 'greymatters'
  END;
  IF v_pillar IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, v_pillar, user_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  IF v_stackedge_role IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, 'stackedge', v_stackedge_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- 3. get_active_tier_id() -- both the p_product literal AND the
-- table-name reference must change together: unlike a view or an RLS
-- policy qual, a plpgsql function body is opaque text re-resolved by
-- name against search_path on each replan, so leaving
-- "FROM freeagent_subscriptions" in place after part 1's rename would
-- make this start throwing "relation does not exist" on next call.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_tier_id(p_user_id UUID, p_product TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tier_id UUID;
BEGIN
  IF p_product = 'flexpro_posting' THEN
    SELECT tier_id INTO v_tier_id FROM flexpro_subscriptions WHERE user_id = p_user_id AND status = 'active';
  ELSIF p_product = 'deepedge_hiring' THEN
    SELECT cs.tier_id INTO v_tier_id
    FROM company_subscriptions cs
    JOIN companies c ON c.id = cs.company_id
    WHERE c.user_id = p_user_id AND cs.status = 'active';
  END IF;
  RETURN v_tier_id;
END;
$$;

-- ------------------------------------------------------------
-- 4. greyin_scores -- freeagent_score/freeagent_evidence/
-- freeagent_headcount are real output columns, not just internal CTE
-- names, so CREATE OR REPLACE VIEW cannot rename them in place
-- (Postgres requires every existing output column to keep its exact
-- name and position). DROP ... CASCADE is safe here: live pg_depend
-- shows exactly one dependent (platform_people_index), and it only
-- reads greyin_score/is_verified_expert, never the freeagent_* trio --
-- confirmed directly against the live database, not inferred from
-- migration history, before writing this. 089's exact body,
-- reproduced with the freeagent CTE names/constant and the 3 output
-- columns renamed -- every number, join, and formula is otherwise
-- unchanged.
-- ------------------------------------------------------------
DROP VIEW public.greyin_scores CASCADE;

CREATE VIEW public.greyin_scores AS
WITH constants AS (
  SELECT 3 AS m_stackedge, 5 AS m_flexpro, 10 AS m_saltnpepper, 5 AS m_greymatters, 3 AS m_peer
),
stackedge_raw AS (
  SELECT subject_user_id AS user_id, AVG(score)::numeric AS raw, COUNT(*) AS v
  FROM public.verified_outcomes
  WHERE status = 'verified'
  GROUP BY subject_user_id
),
flexpro_raw AS (
  SELECT id AS user_id, (seller_rating / 5.0 * 100)::numeric AS raw, total_reviews AS v
  FROM public.profiles
  WHERE total_reviews > 0
),
saltnpepper_raw AS (
  SELECT user_id, (LEAST(SUM(points), 100)::numeric / 100 * 100) AS raw, COUNT(*) AS v
  FROM public.reputation_events
  WHERE event_type = 'project_upvoted'
  GROUP BY user_id
),
greymatters_raw AS (
  SELECT subject_user_id AS user_id, AVG(score)::numeric AS raw, COUNT(*) AS v
  FROM public.ai_quality_scores
  WHERE content_type = 'greymatters_post'
  GROUP BY subject_user_id
),
peer_raw AS (
  SELECT ratee_id AS user_id, (AVG(contribution_rating) / 5.0 * 100)::numeric AS raw, COUNT(*) AS v
  FROM public.peer_project_ratings
  GROUP BY ratee_id
),
platform_stats AS (
  SELECT
    (SELECT AVG(raw) FROM stackedge_raw) AS stackedge_mean,
    (SELECT COUNT(*) FROM stackedge_raw) AS stackedge_headcount,
    (SELECT AVG(raw) FROM flexpro_raw) AS flexpro_mean,
    (SELECT COUNT(*) FROM flexpro_raw) AS flexpro_headcount,
    (SELECT AVG(raw) FROM saltnpepper_raw) AS saltnpepper_mean,
    (SELECT COUNT(*) FROM saltnpepper_raw) AS saltnpepper_headcount,
    (SELECT AVG(raw) FROM greymatters_raw) AS greymatters_mean,
    (SELECT COUNT(*) FROM greymatters_raw) AS greymatters_headcount,
    (SELECT AVG(raw) FROM peer_raw) AS peer_mean,
    (SELECT COUNT(*) FROM peer_raw) AS peer_headcount
),
per_user AS (
  SELECT
    p.id AS user_id,
    p.years_experience,
    pr.v AS stackedge_evidence,
    pr.raw AS stackedge_raw,
    CASE WHEN pr.v IS NOT NULL THEN
      ROUND((pr.v::numeric / (pr.v + c.m_stackedge)) * pr.raw + (c.m_stackedge::numeric / (pr.v + c.m_stackedge)) * s.stackedge_mean)
    END AS stackedge_score,
    fa.v AS flexpro_evidence,
    fa.raw AS flexpro_raw,
    CASE WHEN fa.v IS NOT NULL THEN
      ROUND((fa.v::numeric / (fa.v + c.m_flexpro)) * fa.raw + (c.m_flexpro::numeric / (fa.v + c.m_flexpro)) * s.flexpro_mean)
    END AS flexpro_score,
    sp.v AS saltnpepper_evidence,
    sp.raw AS saltnpepper_raw,
    CASE WHEN sp.v IS NOT NULL THEN
      ROUND((sp.v::numeric / (sp.v + c.m_saltnpepper)) * sp.raw + (c.m_saltnpepper::numeric / (sp.v + c.m_saltnpepper)) * s.saltnpepper_mean)
    END AS saltnpepper_score,
    gm.v AS greymatters_evidence,
    gm.raw AS greymatters_raw,
    CASE WHEN gm.v IS NOT NULL THEN
      ROUND((gm.v::numeric / (gm.v + c.m_greymatters)) * gm.raw + (c.m_greymatters::numeric / (gm.v + c.m_greymatters)) * s.greymatters_mean)
    END AS greymatters_score,
    pe.v AS peer_evidence,
    pe.raw AS peer_raw,
    CASE WHEN pe.v IS NOT NULL THEN
      ROUND((pe.v::numeric / (pe.v + c.m_peer)) * pe.raw + (c.m_peer::numeric / (pe.v + c.m_peer)) * s.peer_mean)
    END AS peer_score,
    s.stackedge_headcount, s.flexpro_headcount, s.saltnpepper_headcount, s.greymatters_headcount, s.peer_headcount
  FROM public.profiles p
  CROSS JOIN constants c
  CROSS JOIN platform_stats s
  LEFT JOIN stackedge_raw pr ON pr.user_id = p.id
  LEFT JOIN flexpro_raw fa ON fa.user_id = p.id
  LEFT JOIN saltnpepper_raw sp ON sp.user_id = p.id
  LEFT JOIN greymatters_raw gm ON gm.user_id = p.id
  LEFT JOIN peer_raw pe ON pe.user_id = p.id
),
scored AS (
  SELECT
    user_id,
    stackedge_score, stackedge_evidence, stackedge_headcount,
    flexpro_score, flexpro_evidence, flexpro_headcount,
    saltnpepper_score, saltnpepper_evidence, saltnpepper_headcount,
    greymatters_score, greymatters_evidence, greymatters_headcount,
    years_experience,
    ROUND(
      (
        COALESCE(stackedge_score * LN(stackedge_headcount + 1), 0) +
        COALESCE(flexpro_score * LN(flexpro_headcount + 1), 0) +
        COALESCE(saltnpepper_score * LN(saltnpepper_headcount + 1), 0) +
        COALESCE(greymatters_score * LN(greymatters_headcount + 1), 0)
      ) / NULLIF(
        (CASE WHEN stackedge_score IS NOT NULL THEN LN(stackedge_headcount + 1) ELSE 0 END) +
        (CASE WHEN flexpro_score IS NOT NULL THEN LN(flexpro_headcount + 1) ELSE 0 END) +
        (CASE WHEN saltnpepper_score IS NOT NULL THEN LN(saltnpepper_headcount + 1) ELSE 0 END) +
        (CASE WHEN greymatters_score IS NOT NULL THEN LN(greymatters_headcount + 1) ELSE 0 END),
        0
      )
    ) AS platform_composite,
    CASE WHEN stackedge_score IS NOT NULL OR flexpro_score IS NOT NULL OR saltnpepper_score IS NOT NULL OR greymatters_score IS NOT NULL THEN
      ROUND(
        0.85 * (
          (
            COALESCE(stackedge_score * LN(stackedge_headcount + 1), 0) +
            COALESCE(flexpro_score * LN(flexpro_headcount + 1), 0) +
            COALESCE(saltnpepper_score * LN(saltnpepper_headcount + 1), 0) +
            COALESCE(greymatters_score * LN(greymatters_headcount + 1), 0)
          ) / NULLIF(
            (CASE WHEN stackedge_score IS NOT NULL THEN LN(stackedge_headcount + 1) ELSE 0 END) +
            (CASE WHEN flexpro_score IS NOT NULL THEN LN(flexpro_headcount + 1) ELSE 0 END) +
            (CASE WHEN saltnpepper_score IS NOT NULL THEN LN(saltnpepper_headcount + 1) ELSE 0 END) +
            (CASE WHEN greymatters_score IS NOT NULL THEN LN(greymatters_headcount + 1) ELSE 0 END),
            0
          )
        ) + 0.15 * (LEAST(COALESCE(years_experience, 0), 20) / 20.0 * 100)
      )
    END AS greyin_score
  FROM per_user
),
gated AS (
  SELECT
    *,
    (
      COALESCE(years_experience, 0) >= (SELECT min_years_experience FROM public.platform_gate_settings WHERE id = 1)
      OR COALESCE(greyin_score, 0) >= (SELECT min_greyin_score FROM public.platform_gate_settings WHERE id = 1)
    ) AS is_verified_expert
  FROM scored
)
SELECT gated.*, pu.peer_score, pu.peer_evidence, pu.peer_headcount
FROM gated
JOIN per_user pu ON pu.user_id = gated.user_id;

GRANT SELECT ON public.greyin_scores TO anon, authenticated;

-- 060's exact body, unchanged -- dropped by the CASCADE above purely
-- as a side effect of depending on greyin_scores' column list, not
-- because anything about it needs to change.
CREATE OR REPLACE VIEW public.platform_people_index AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.location,
  gs.greyin_score,
  COALESCE(gs.is_verified_expert, false) AS is_verified_expert,
  COALESCE(vo.verified_outcomes_count, 0) AS verified_outcomes_count,
  COALESCE(ps.skills, ARRAY[]::text[]) AS skills,
  c.availability,
  c.current_title,
  p.is_mentor,
  p.mentor_domain
FROM public.profiles p
LEFT JOIN public.greyin_scores gs ON gs.user_id = p.id
LEFT JOIN public.candidates c ON c.user_id = p.id
LEFT JOIN (
  SELECT subject_user_id, COUNT(*) AS verified_outcomes_count
  FROM public.verified_outcomes
  WHERE status = 'verified'
  GROUP BY subject_user_id
) vo ON vo.subject_user_id = p.id
LEFT JOIN (
  SELECT user_id, array_agg(skill ORDER BY skill) AS skills
  FROM public.profile_skills
  GROUP BY user_id
) ps ON ps.user_id = p.id;

-- The CASCADE above also took out 4 RLS policies (on posts and
-- comments) that gate on greyin_scores.is_verified_expert -- none of
-- them touch the freeagent_* columns either, confirmed by reading
-- their live definitions before writing this. Recreated verbatim.
CREATE POLICY "Published posts respect their view audience"
  ON public.posts FOR SELECT
  USING (
    status = 'published' AND (
      view_audience = 'public'
      OR (view_audience = 'follower' AND auth.role() = 'authenticated')
      OR (view_audience = 'verified_expert' AND EXISTS (SELECT 1 FROM public.greyin_scores WHERE greyin_scores.user_id = auth.uid() AND greyin_scores.is_verified_expert))
    )
  );

CREATE POLICY "Verified experts can insert posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id AND (
      EXISTS (SELECT 1 FROM public.greyin_scores WHERE greyin_scores.user_id = auth.uid() AND greyin_scores.is_verified_expert)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    )
  );

CREATE POLICY "Approved comments respect their post's comment audience"
  ON public.comments FOR SELECT
  USING (
    status = 'approved' AND EXISTS (
      SELECT 1 FROM public.posts p WHERE p.id = comments.post_id AND (
        p.comment_audience = 'public'
        OR (p.comment_audience = 'follower' AND auth.role() = 'authenticated')
        OR (p.comment_audience = 'verified_expert' AND EXISTS (SELECT 1 FROM public.greyin_scores WHERE greyin_scores.user_id = auth.uid() AND greyin_scores.is_verified_expert))
      )
    )
  );

CREATE POLICY "Comments respect their post's comment audience"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.posts p WHERE p.id = comments.post_id AND (
        p.comment_audience = 'public'
        OR (p.comment_audience = 'follower' AND auth.role() = 'authenticated')
        OR (p.comment_audience = 'verified_expert' AND EXISTS (SELECT 1 FROM public.greyin_scores WHERE greyin_scores.user_id = auth.uid() AND greyin_scores.is_verified_expert))
      )
    )
  );

-- ------------------------------------------------------------
-- 5. The other 4 UNION ALL views -- literal pillar-tag VALUES only,
-- no column name/order changes, so CREATE OR REPLACE VIEW applies
-- cleanly. platform_search_index and activity_feed both currently
-- carry security_invoker=true live (079, 080) -- CREATE OR REPLACE
-- VIEW resets reloptions, so both are reissued explicitly right after.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.platform_search_index AS
  SELECT 'post'::text AS type,
    'greymatters'::text AS pillar,
    posts.id, posts.title, posts.excerpt AS description,
    '/posts/'::text || posts.slug AS path, posts.created_at
  FROM posts WHERE posts.status = 'published'::text
UNION ALL
  SELECT 'job'::text AS type,
    'greyin'::text AS pillar,
    jobs.id, jobs.title, jobs.description,
    '/jobs/'::text || jobs.id AS path, jobs.created_at
  FROM jobs WHERE jobs.status = 'open'::text
UNION ALL
  SELECT 'gig'::text AS type,
    'flexpro'::text AS pillar,
    gigs.id, gigs.title, gigs.description,
    '/gigs/'::text || gigs.id AS path, gigs.created_at
  FROM gigs WHERE gigs.status = 'active'::text
UNION ALL
  SELECT 'discussion'::text AS type,
    'saltnpepper'::text AS pillar,
    discussions.id, discussions.title, discussions.body AS description,
    '/discussions/'::text || discussions.id AS path, discussions.created_at
  FROM discussions
UNION ALL
  SELECT 'project'::text AS type,
    'stackedge'::text AS pillar,
    builder_projects.id, builder_projects.title, builder_projects.description,
    '/projects/'::text || builder_projects.id AS path, builder_projects.created_at
  FROM builder_projects;

ALTER VIEW public.platform_search_index SET (security_invoker = true);

-- 047's exact body -- note the pre-existing 'expertedge' pillar tags
-- here (the my_pillar_activity/activity_feed inconsistency 047 itself
-- flagged) are DeepEdge's divergence, not FreeAgent's, and are
-- deliberately left untouched for App 3's own pass.
CREATE OR REPLACE VIEW public.my_pillar_activity AS
SELECT * FROM (
  SELECT subject_user_id AS user_id, 'stackedge' AS pillar, 'verified_outcome' AS event_type, created_at AS occurred_at FROM public.verified_outcomes
  UNION ALL
  SELECT user_id, 'stackedge', 'project_created', created_at FROM public.builder_projects
  UNION ALL
  SELECT created_by, 'stackedge', 'ask_created', created_at FROM public.project_asks
  UNION ALL
  SELECT reviewee_id, 'flexpro', 'review_received', created_at FROM public.order_reviews
  UNION ALL
  SELECT freelancer_id, 'flexpro', 'gig_listed', created_at FROM public.gigs
  UNION ALL
  SELECT author_id, 'saltnpepper', 'discussion', created_at FROM public.discussions
  UNION ALL
  SELECT author_id, 'saltnpepper', 'discussion_reply', created_at FROM public.discussion_replies
  UNION ALL
  SELECT author_id, 'greymatters', 'post', created_at FROM public.posts WHERE author_id IS NOT NULL
  UNION ALL
  SELECT user_id, 'greymatters', 'comment', created_at FROM public.comments
  UNION ALL
  SELECT c.user_id, 'expertedge', 'application', a.applied_at FROM public.applications a JOIN public.candidates c ON c.id = a.candidate_id
  UNION ALL
  SELECT co.user_id, 'expertedge', 'job_posted', j.created_at FROM public.jobs j JOIN public.companies co ON co.id = j.company_id
) t
WHERE user_id = auth.uid();

GRANT SELECT ON public.my_pillar_activity TO authenticated;

CREATE OR REPLACE VIEW public.activity_feed AS
  SELECT
    'greymatters'::text AS pillar,
    'post'::text AS content_type,
    posts.id,
    posts.author_id,
    posts.title,
    posts.excerpt AS description,
    COALESCE(posts.published_at, posts.created_at) AS occurred_at,
    '/posts/' || posts.slug AS path,
    posts.feed_visibility
  FROM public.posts
  WHERE posts.status = 'published'
UNION ALL
  SELECT
    'saltnpepper'::text,
    'discussion'::text,
    discussions.id,
    CASE WHEN discussions.is_anonymous THEN NULL ELSE discussions.author_id END,
    discussions.title,
    discussions.body AS description,
    discussions.created_at AS occurred_at,
    '/discussions/' || discussions.id AS path,
    discussions.feed_visibility
  FROM public.discussions
UNION ALL
  SELECT
    'stackedge'::text,
    'project_update'::text,
    pu.id,
    pu.author_id,
    'Update on ' || bp.title AS title,
    pu.body AS description,
    pu.created_at AS occurred_at,
    '/projects/' || pu.project_id AS path,
    pu.feed_visibility
  FROM public.project_updates pu
  JOIN public.builder_projects bp ON bp.id = pu.project_id
UNION ALL
  SELECT
    'flexpro'::text,
    'gig'::text,
    gigs.id,
    gigs.freelancer_id,
    gigs.title,
    gigs.description,
    gigs.created_at AS occurred_at,
    '/gigs/' || gigs.id AS path,
    gigs.feed_visibility
  FROM public.gigs
  WHERE gigs.status = 'active'
UNION ALL
  SELECT
    'greyin'::text,
    'job'::text,
    j.id,
    co.user_id,
    j.title,
    j.description,
    j.created_at AS occurred_at,
    '/jobs/' || j.id AS path,
    j.feed_visibility
  FROM public.jobs j
  JOIN public.companies co ON co.id = j.company_id
  WHERE j.status = 'open';

ALTER VIEW public.activity_feed SET (security_invoker = true);

-- collaborators: NOT reissuing security_invoker here -- live state
-- confirmed it is already unset (089's own CREATE OR REPLACE silently
-- dropped 067's setting, pre-existing and unrelated to this rename;
-- flagged to the user separately rather than changed as a side effect
-- of this migration).
CREATE OR REPLACE VIEW public.collaborators AS
  SELECT ask.created_by AS user_id, pa.applicant_id AS collaborator_id, 'stackedge'::text AS pillar, pa.created_at AS occurred_at
  FROM public.project_applications pa
  JOIN public.project_asks ask ON ask.id = pa.ask_id
  WHERE pa.status = 'accepted'
UNION ALL
  SELECT pa.applicant_id, ask.created_by, 'stackedge'::text, pa.created_at
  FROM public.project_applications pa
  JOIN public.project_asks ask ON ask.id = pa.ask_id
  WHERE pa.status = 'accepted'
UNION ALL
  SELECT go.buyer_id, go.seller_id, 'flexpro'::text, go.completed_at
  FROM public.gig_orders go
  WHERE go.status = 'completed'
UNION ALL
  SELECT go.seller_id, go.buyer_id, 'flexpro'::text, go.completed_at
  FROM public.gig_orders go
  WHERE go.status = 'completed'
UNION ALL
  SELECT m1.user_id, m2.user_id, 'peer'::text, GREATEST(m1.responded_at, m2.responded_at)
  FROM public.peer_project_members m1
  JOIN public.peer_project_members m2 ON m1.project_id = m2.project_id AND m1.user_id <> m2.user_id
  WHERE m1.status = 'confirmed' AND m2.status = 'confirmed';

GRANT SELECT ON public.collaborators TO authenticated;

-- ------------------------------------------------------------
-- 6. CHECK constraints + the live data they gate -- each table's old
-- constraint is dropped, its data updated, THEN the new (now stricter)
-- constraint added -- adding the new constraint before updating the
-- data it would reject fails immediately against the still-old-valued
-- row (caught by this migration's own dry run). Every sibling value in
-- each array is preserved exactly; only the freeagent entries change.
-- Row counts confirmed live immediately before writing this migration
-- (see header) -- verify the same counts moved, not disappeared,
-- after running.
-- ------------------------------------------------------------
ALTER TABLE public.pillar_memberships DROP CONSTRAINT pillar_memberships_pillar_check;
UPDATE public.pillar_memberships SET pillar = 'flexpro' WHERE pillar = 'freeagent';
ALTER TABLE public.pillar_memberships ADD CONSTRAINT pillar_memberships_pillar_check
  CHECK (pillar = ANY (ARRAY['greyin', 'greymatters', 'saltnpepper', 'flexpro', 'stackedge', 'longlist']));

ALTER TABLE public.subscription_plans DROP CONSTRAINT subscription_plans_tier_check;
UPDATE public.subscription_plans SET tier = 'flexpro_pro' WHERE tier = 'freeagent_pro';
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_tier_check
  CHECK (tier = ANY (ARRAY['starter', 'enterprise', 'flexpro_pro']));

ALTER TABLE public.subscription_tiers DROP CONSTRAINT subscription_tiers_product_check;
UPDATE public.subscription_tiers SET product = 'flexpro_posting' WHERE product = 'freeagent_posting';
ALTER TABLE public.subscription_tiers ADD CONSTRAINT subscription_tiers_product_check
  CHECK (product = ANY (ARRAY['flexpro_posting', 'deepedge_hiring']));

ALTER TABLE public.ai_quality_scores DROP CONSTRAINT ai_quality_scores_content_type_check;
ALTER TABLE public.ai_quality_scores DROP CONSTRAINT ai_quality_scores_content_shape;
-- ai_quality_scores has 0 rows with content_type='freeagent_delivery' today
-- (confirmed live) but update defensively in case one lands between the
-- confirm and this running.
UPDATE public.ai_quality_scores SET content_type = 'flexpro_delivery' WHERE content_type = 'freeagent_delivery';
ALTER TABLE public.ai_quality_scores ADD CONSTRAINT ai_quality_scores_content_type_check
  CHECK (content_type = ANY (ARRAY['greymatters_post', 'saltnpepper_reply', 'flexpro_delivery']));
ALTER TABLE public.ai_quality_scores ADD CONSTRAINT ai_quality_scores_content_shape CHECK (
  (content_type = 'greymatters_post' AND post_id IS NOT NULL AND discussion_reply_id IS NULL AND gig_order_id IS NULL) OR
  (content_type = 'saltnpepper_reply' AND discussion_reply_id IS NOT NULL AND post_id IS NULL AND gig_order_id IS NULL) OR
  (content_type = 'flexpro_delivery' AND gig_order_id IS NOT NULL AND post_id IS NULL AND discussion_reply_id IS NULL)
);

UPDATE public.llm_feature_flags SET feature_key = 'flexpro_delivery_quality' WHERE feature_key = 'freeagent_delivery_quality';
UPDATE public.llm_feature_flags SET feature_key = 'flexpro_gig_quality' WHERE feature_key = 'freeagent_gig_quality';

COMMIT;

NOTIFY pgrst, 'reload schema';
