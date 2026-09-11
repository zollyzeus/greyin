-- Fixes a real scalability defect in greyin_scores, confirmed via
-- EXPLAIN ANALYZE (not guessed): the view recomputed 5 global platform
-- means from full, unindexed Seq Scans over verified_outcomes/
-- reputation_events/ai_quality_scores/profiles/peer_project_ratings on
-- EVERY single read, even a `WHERE user_id = X` lookup for one user --
-- Postgres only applies that filter at the very end, after building the
-- whole platform's per-user table. At 10x users and evidence volume,
-- every profile view / search result / admin listing pays a
-- full-platform-scan tax. Verified live: single-user lookup showed
-- `Rows Removed by Filter: 297` out of 298 total profiles.
--
-- Fix: split the computation by how fast each part actually changes.
--  - Per-user raw scores/evidence counts change only when that one user
--    gets a new contribution -- maintained incrementally by triggers on
--    each evidence table, O(1) per contribution instead of O(all users)
--    per read.
--  - The 5 global platform means are slow-moving statistics (a shrinkage
--    target, not a live number anyone needs instant-fresh) -- cached in
--    a singleton row, refreshed periodically (same "no pg_cron, use an
--    app-level timer" pattern as post-quality.ts's runPeriodicSweepIfDue),
--    decoupling their cost from read volume entirely.
-- greyin_scores itself is rewritten to read these two small cached
-- tables instead of aggregating raw evidence -- same output columns,
-- same formula, CREATE OR REPLACE (not DROP) so platform_people_index
-- and the RLS policies already built on top of this view are untouched.

CREATE TABLE greyin_score_inputs (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  stackworks_raw numeric,
  stackworks_evidence integer,
  flexpro_raw numeric,
  flexpro_evidence integer,
  saltnpepper_raw numeric,
  saltnpepper_evidence integer,
  greymatters_raw numeric,
  greymatters_evidence integer,
  peer_raw numeric,
  peer_evidence integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_score_means (
  id integer PRIMARY KEY DEFAULT 1,
  stackworks_mean numeric,
  stackworks_headcount bigint NOT NULL DEFAULT 0,
  flexpro_mean numeric,
  flexpro_headcount bigint NOT NULL DEFAULT 0,
  saltnpepper_mean numeric,
  saltnpepper_headcount bigint NOT NULL DEFAULT 0,
  greymatters_mean numeric,
  greymatters_headcount bigint NOT NULL DEFAULT 0,
  peer_mean numeric,
  peer_headcount bigint NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_score_means_singleton CHECK (id = 1)
);

-- Backfill greyin_score_inputs from the exact same raw-evidence logic
-- the old view used, so the migration to the cache is itself lossless.
INSERT INTO greyin_score_inputs (user_id, stackworks_raw, stackworks_evidence, flexpro_raw, flexpro_evidence, saltnpepper_raw, saltnpepper_evidence, greymatters_raw, greymatters_evidence, peer_raw, peer_evidence)
SELECT
  p.id,
  sw.raw, sw.v,
  fp.raw, fp.v,
  sp.raw, sp.v,
  gm.raw, gm.v,
  pe.raw, pe.v
FROM profiles p
LEFT JOIN (SELECT subject_user_id AS user_id, avg(score) AS raw, count(*) AS v FROM verified_outcomes WHERE status = 'verified' GROUP BY subject_user_id) sw ON sw.user_id = p.id
LEFT JOIN (SELECT id AS user_id, seller_rating / 5.0 * 100 AS raw, total_reviews AS v FROM profiles WHERE total_reviews > 0) fp ON fp.user_id = p.id
LEFT JOIN (SELECT user_id, LEAST(sum(points), 100)::numeric / 100 * 100 AS raw, count(*) AS v FROM reputation_events WHERE event_type = 'project_upvoted' GROUP BY user_id) sp ON sp.user_id = p.id
LEFT JOIN (SELECT subject_user_id AS user_id, avg(score) AS raw, count(*) AS v FROM ai_quality_scores WHERE content_type = 'greymatters_post' GROUP BY subject_user_id) gm ON gm.user_id = p.id
LEFT JOIN (SELECT ratee_id AS user_id, avg(contribution_rating) / 5.0 * 100 AS raw, count(*) AS v FROM peer_project_ratings GROUP BY ratee_id) pe ON pe.user_id = p.id;

-- Backfill the singleton means row the same way.
INSERT INTO platform_score_means (id, stackworks_mean, stackworks_headcount, flexpro_mean, flexpro_headcount, saltnpepper_mean, saltnpepper_headcount, greymatters_mean, greymatters_headcount, peer_mean, peer_headcount)
SELECT
  1,
  avg(stackworks_raw) FILTER (WHERE stackworks_evidence IS NOT NULL), count(*) FILTER (WHERE stackworks_evidence IS NOT NULL),
  avg(flexpro_raw) FILTER (WHERE flexpro_evidence IS NOT NULL), count(*) FILTER (WHERE flexpro_evidence IS NOT NULL),
  avg(saltnpepper_raw) FILTER (WHERE saltnpepper_evidence IS NOT NULL), count(*) FILTER (WHERE saltnpepper_evidence IS NOT NULL),
  avg(greymatters_raw) FILTER (WHERE greymatters_evidence IS NOT NULL), count(*) FILTER (WHERE greymatters_evidence IS NOT NULL),
  avg(peer_raw) FILTER (WHERE peer_evidence IS NOT NULL), count(*) FILTER (WHERE peer_evidence IS NOT NULL)
FROM greyin_score_inputs;

-- Periodic refresh (app-level timer calls this, no pg_cron in this
-- deployment) -- cheap relative to the old per-read cost: one pass over
-- the already-aggregated greyin_score_inputs table, not 5 raw evidence
-- tables, and only runs on a schedule instead of on every read.
CREATE OR REPLACE FUNCTION refresh_platform_score_means()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE platform_score_means SET
    stackworks_mean = m.stackworks_mean, stackworks_headcount = m.stackworks_headcount,
    flexpro_mean = m.flexpro_mean, flexpro_headcount = m.flexpro_headcount,
    saltnpepper_mean = m.saltnpepper_mean, saltnpepper_headcount = m.saltnpepper_headcount,
    greymatters_mean = m.greymatters_mean, greymatters_headcount = m.greymatters_headcount,
    peer_mean = m.peer_mean, peer_headcount = m.peer_headcount,
    refreshed_at = now()
  FROM (
    SELECT
      avg(stackworks_raw) FILTER (WHERE stackworks_evidence IS NOT NULL) AS stackworks_mean,
      count(*) FILTER (WHERE stackworks_evidence IS NOT NULL) AS stackworks_headcount,
      avg(flexpro_raw) FILTER (WHERE flexpro_evidence IS NOT NULL) AS flexpro_mean,
      count(*) FILTER (WHERE flexpro_evidence IS NOT NULL) AS flexpro_headcount,
      avg(saltnpepper_raw) FILTER (WHERE saltnpepper_evidence IS NOT NULL) AS saltnpepper_mean,
      count(*) FILTER (WHERE saltnpepper_evidence IS NOT NULL) AS saltnpepper_headcount,
      avg(greymatters_raw) FILTER (WHERE greymatters_evidence IS NOT NULL) AS greymatters_mean,
      count(*) FILTER (WHERE greymatters_evidence IS NOT NULL) AS greymatters_headcount,
      avg(peer_raw) FILTER (WHERE peer_evidence IS NOT NULL) AS peer_mean,
      count(*) FILTER (WHERE peer_evidence IS NOT NULL) AS peer_headcount
    FROM greyin_score_inputs
  ) m
  WHERE platform_score_means.id = 1;
END;
$$;

-- Per-user incremental maintenance -- each trigger recomputes only the
-- ONE affected user's row (indexed lookup + a scan bounded by that
-- user's own evidence, not the whole table).

CREATE OR REPLACE FUNCTION sync_stackworks_score_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := COALESCE(NEW.subject_user_id, OLD.subject_user_id);
BEGIN
  INSERT INTO greyin_score_inputs (user_id, stackworks_raw, stackworks_evidence, updated_at)
  SELECT v_user_id, avg(score), count(*), now()
  FROM verified_outcomes WHERE subject_user_id = v_user_id AND status = 'verified'
  ON CONFLICT (user_id) DO UPDATE SET
    stackworks_raw = EXCLUDED.stackworks_raw, stackworks_evidence = EXCLUDED.stackworks_evidence, updated_at = now();
  -- No evidence left at all (e.g. the only verified row was deleted) --
  -- the SELECT above returns zero rows, so nothing was inserted/updated;
  -- explicitly null out the cached fields instead of leaving them stale.
  IF NOT EXISTS (SELECT 1 FROM verified_outcomes WHERE subject_user_id = v_user_id AND status = 'verified') THEN
    UPDATE greyin_score_inputs SET stackworks_raw = NULL, stackworks_evidence = NULL, updated_at = now() WHERE user_id = v_user_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER sync_stackworks_score_input
AFTER INSERT OR UPDATE OR DELETE ON verified_outcomes
FOR EACH ROW EXECUTE FUNCTION sync_stackworks_score_input();

CREATE OR REPLACE FUNCTION sync_flexpro_score_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.seller_rating IS DISTINCT FROM OLD.seller_rating OR NEW.total_reviews IS DISTINCT FROM OLD.total_reviews THEN
    INSERT INTO greyin_score_inputs (user_id, flexpro_raw, flexpro_evidence, updated_at)
    VALUES (NEW.id, CASE WHEN NEW.total_reviews > 0 THEN NEW.seller_rating / 5.0 * 100 ELSE NULL END, NULLIF(NEW.total_reviews, 0), now())
    ON CONFLICT (user_id) DO UPDATE SET
      flexpro_raw = EXCLUDED.flexpro_raw, flexpro_evidence = EXCLUDED.flexpro_evidence, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_flexpro_score_input
AFTER UPDATE OF seller_rating, total_reviews ON profiles
FOR EACH ROW EXECUTE FUNCTION sync_flexpro_score_input();

CREATE OR REPLACE FUNCTION sync_saltnpepper_score_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  INSERT INTO greyin_score_inputs (user_id, saltnpepper_raw, saltnpepper_evidence, updated_at)
  SELECT v_user_id, LEAST(sum(points), 100)::numeric / 100 * 100, count(*), now()
  FROM reputation_events WHERE user_id = v_user_id AND event_type = 'project_upvoted'
  ON CONFLICT (user_id) DO UPDATE SET
    saltnpepper_raw = EXCLUDED.saltnpepper_raw, saltnpepper_evidence = EXCLUDED.saltnpepper_evidence, updated_at = now();
  IF NOT EXISTS (SELECT 1 FROM reputation_events WHERE user_id = v_user_id AND event_type = 'project_upvoted') THEN
    UPDATE greyin_score_inputs SET saltnpepper_raw = NULL, saltnpepper_evidence = NULL, updated_at = now() WHERE user_id = v_user_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER sync_saltnpepper_score_input
AFTER INSERT OR UPDATE OR DELETE ON reputation_events
FOR EACH ROW EXECUTE FUNCTION sync_saltnpepper_score_input();

CREATE OR REPLACE FUNCTION sync_greymatters_score_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := COALESCE(NEW.subject_user_id, OLD.subject_user_id);
BEGIN
  IF COALESCE(NEW.content_type, OLD.content_type) != 'greymatters_post' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  INSERT INTO greyin_score_inputs (user_id, greymatters_raw, greymatters_evidence, updated_at)
  SELECT v_user_id, avg(score), count(*), now()
  FROM ai_quality_scores WHERE subject_user_id = v_user_id AND content_type = 'greymatters_post'
  ON CONFLICT (user_id) DO UPDATE SET
    greymatters_raw = EXCLUDED.greymatters_raw, greymatters_evidence = EXCLUDED.greymatters_evidence, updated_at = now();
  IF NOT EXISTS (SELECT 1 FROM ai_quality_scores WHERE subject_user_id = v_user_id AND content_type = 'greymatters_post') THEN
    UPDATE greyin_score_inputs SET greymatters_raw = NULL, greymatters_evidence = NULL, updated_at = now() WHERE user_id = v_user_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER sync_greymatters_score_input
AFTER INSERT OR UPDATE OR DELETE ON ai_quality_scores
FOR EACH ROW EXECUTE FUNCTION sync_greymatters_score_input();

CREATE OR REPLACE FUNCTION sync_peer_score_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := COALESCE(NEW.ratee_id, OLD.ratee_id);
BEGIN
  INSERT INTO greyin_score_inputs (user_id, peer_raw, peer_evidence, updated_at)
  SELECT v_user_id, avg(contribution_rating) / 5.0 * 100, count(*), now()
  FROM peer_project_ratings WHERE ratee_id = v_user_id
  ON CONFLICT (user_id) DO UPDATE SET
    peer_raw = EXCLUDED.peer_raw, peer_evidence = EXCLUDED.peer_evidence, updated_at = now();
  IF NOT EXISTS (SELECT 1 FROM peer_project_ratings WHERE ratee_id = v_user_id) THEN
    UPDATE greyin_score_inputs SET peer_raw = NULL, peer_evidence = NULL, updated_at = now() WHERE user_id = v_user_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER sync_peer_score_input
AFTER INSERT OR UPDATE OR DELETE ON peer_project_ratings
FOR EACH ROW EXECUTE FUNCTION sync_peer_score_input();

-- New profiles start with no cached row -- fine, every trigger above
-- upserts on first real contribution; the view's LEFT JOIN already
-- treats a missing greyin_score_inputs row identically to one with all
-- NULL evidence columns.

ALTER TABLE greyin_score_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view score inputs" ON greyin_score_inputs FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policy for any client role -- written only by
-- the SECURITY DEFINER trigger functions above (which run as their
-- owner, bypassing RLS) and the service role.

ALTER TABLE platform_score_means ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view platform score means" ON platform_score_means FOR SELECT USING (true);

-- greyin_scores itself: same output columns, same formula, now reading
-- the cached tables above instead of aggregating raw evidence.
-- CREATE OR REPLACE (not DROP) so platform_people_index and the RLS
-- policies already built on top of this view are left untouched.
CREATE OR REPLACE VIEW greyin_scores AS
WITH constants AS (
  SELECT 3 AS m_stackworks, 5 AS m_flexpro, 10 AS m_saltnpepper, 5 AS m_greymatters, 3 AS m_peer
),
per_user AS (
  SELECT
    p.id AS user_id,
    p.years_experience,
    i.stackworks_evidence::bigint AS stackworks_evidence,
    i.stackworks_raw AS stackworks_raw,
    CASE WHEN i.stackworks_evidence IS NOT NULL THEN round(i.stackworks_evidence::numeric / (i.stackworks_evidence + c.m_stackworks)::numeric * i.stackworks_raw + c.m_stackworks::numeric / (i.stackworks_evidence + c.m_stackworks)::numeric * m.stackworks_mean) ELSE NULL::numeric END AS stackworks_score,
    i.flexpro_evidence AS flexpro_evidence,
    i.flexpro_raw AS flexpro_raw,
    CASE WHEN i.flexpro_evidence IS NOT NULL THEN round(i.flexpro_evidence::numeric / (i.flexpro_evidence + c.m_flexpro)::numeric * i.flexpro_raw + c.m_flexpro::numeric / (i.flexpro_evidence + c.m_flexpro)::numeric * m.flexpro_mean) ELSE NULL::numeric END AS flexpro_score,
    i.saltnpepper_evidence::bigint AS saltnpepper_evidence,
    i.saltnpepper_raw AS saltnpepper_raw,
    CASE WHEN i.saltnpepper_evidence IS NOT NULL THEN round(i.saltnpepper_evidence::numeric / (i.saltnpepper_evidence + c.m_saltnpepper)::numeric * i.saltnpepper_raw + c.m_saltnpepper::numeric / (i.saltnpepper_evidence + c.m_saltnpepper)::numeric * m.saltnpepper_mean) ELSE NULL::numeric END AS saltnpepper_score,
    i.greymatters_evidence::bigint AS greymatters_evidence,
    i.greymatters_raw AS greymatters_raw,
    CASE WHEN i.greymatters_evidence IS NOT NULL THEN round(i.greymatters_evidence::numeric / (i.greymatters_evidence + c.m_greymatters)::numeric * i.greymatters_raw + c.m_greymatters::numeric / (i.greymatters_evidence + c.m_greymatters)::numeric * m.greymatters_mean) ELSE NULL::numeric END AS greymatters_score,
    i.peer_evidence::bigint AS peer_evidence,
    i.peer_raw AS peer_raw,
    CASE WHEN i.peer_evidence IS NOT NULL THEN round(i.peer_evidence::numeric / (i.peer_evidence + c.m_peer)::numeric * i.peer_raw + c.m_peer::numeric / (i.peer_evidence + c.m_peer)::numeric * m.peer_mean) ELSE NULL::numeric END AS peer_score,
    m.stackworks_headcount, m.flexpro_headcount, m.saltnpepper_headcount, m.greymatters_headcount, m.peer_headcount
  FROM profiles p
  CROSS JOIN constants c
  CROSS JOIN platform_score_means m
  LEFT JOIN greyin_score_inputs i ON i.user_id = p.id
),
scored AS (
  SELECT
    per_user.user_id, per_user.stackworks_score, per_user.stackworks_evidence, per_user.stackworks_headcount,
    per_user.flexpro_score, per_user.flexpro_evidence, per_user.flexpro_headcount,
    per_user.saltnpepper_score, per_user.saltnpepper_evidence, per_user.saltnpepper_headcount,
    per_user.greymatters_score, per_user.greymatters_evidence, per_user.greymatters_headcount,
    per_user.years_experience,
    round((COALESCE(per_user.stackworks_score::double precision * ln((per_user.stackworks_headcount + 1)::double precision), 0::double precision) + COALESCE(per_user.flexpro_score::double precision * ln((per_user.flexpro_headcount + 1)::double precision), 0::double precision) + COALESCE(per_user.saltnpepper_score::double precision * ln((per_user.saltnpepper_headcount + 1)::double precision), 0::double precision) + COALESCE(per_user.greymatters_score::double precision * ln((per_user.greymatters_headcount + 1)::double precision), 0::double precision)) / NULLIF(
      CASE WHEN per_user.stackworks_score IS NOT NULL THEN ln((per_user.stackworks_headcount + 1)::double precision) ELSE 0::double precision END +
      CASE WHEN per_user.flexpro_score IS NOT NULL THEN ln((per_user.flexpro_headcount + 1)::double precision) ELSE 0::double precision END +
      CASE WHEN per_user.saltnpepper_score IS NOT NULL THEN ln((per_user.saltnpepper_headcount + 1)::double precision) ELSE 0::double precision END +
      CASE WHEN per_user.greymatters_score IS NOT NULL THEN ln((per_user.greymatters_headcount + 1)::double precision) ELSE 0::double precision END, 0::double precision)) AS platform_composite,
    CASE WHEN per_user.stackworks_score IS NOT NULL OR per_user.flexpro_score IS NOT NULL OR per_user.saltnpepper_score IS NOT NULL OR per_user.greymatters_score IS NOT NULL THEN round(0.85::double precision * ((COALESCE(per_user.stackworks_score::double precision * ln((per_user.stackworks_headcount + 1)::double precision), 0::double precision) + COALESCE(per_user.flexpro_score::double precision * ln((per_user.flexpro_headcount + 1)::double precision), 0::double precision) + COALESCE(per_user.saltnpepper_score::double precision * ln((per_user.saltnpepper_headcount + 1)::double precision), 0::double precision) + COALESCE(per_user.greymatters_score::double precision * ln((per_user.greymatters_headcount + 1)::double precision), 0::double precision)) / NULLIF(
      CASE WHEN per_user.stackworks_score IS NOT NULL THEN ln((per_user.stackworks_headcount + 1)::double precision) ELSE 0::double precision END +
      CASE WHEN per_user.flexpro_score IS NOT NULL THEN ln((per_user.flexpro_headcount + 1)::double precision) ELSE 0::double precision END +
      CASE WHEN per_user.saltnpepper_score IS NOT NULL THEN ln((per_user.saltnpepper_headcount + 1)::double precision) ELSE 0::double precision END +
      CASE WHEN per_user.greymatters_score IS NOT NULL THEN ln((per_user.greymatters_headcount + 1)::double precision) ELSE 0::double precision END, 0::double precision)) + (0.15 * (LEAST(COALESCE(per_user.years_experience, 0), 20)::numeric / 20.0 * 100::numeric))::double precision)
      ELSE NULL::double precision
    END AS greyin_score
  FROM per_user
),
gated AS (
  SELECT
    scored.user_id, scored.stackworks_score, scored.stackworks_evidence, scored.stackworks_headcount,
    scored.flexpro_score, scored.flexpro_evidence, scored.flexpro_headcount,
    scored.saltnpepper_score, scored.saltnpepper_evidence, scored.saltnpepper_headcount,
    scored.greymatters_score, scored.greymatters_evidence, scored.greymatters_headcount,
    scored.years_experience, scored.platform_composite, scored.greyin_score,
    COALESCE(scored.years_experience, 0) >= (SELECT min_years_experience FROM platform_gate_settings WHERE id = 1)
      OR COALESCE(scored.greyin_score, 0::double precision) >= (SELECT min_greyin_score FROM platform_gate_settings WHERE id = 1)::double precision AS is_verified_expert
  FROM scored
)
SELECT
  gated.user_id, gated.stackworks_score, gated.stackworks_evidence, gated.stackworks_headcount,
  gated.flexpro_score, gated.flexpro_evidence, gated.flexpro_headcount,
  gated.saltnpepper_score, gated.saltnpepper_evidence, gated.saltnpepper_headcount,
  gated.greymatters_score, gated.greymatters_evidence, gated.greymatters_headcount,
  gated.years_experience, gated.platform_composite, gated.greyin_score, gated.is_verified_expert,
  per_user.peer_score, per_user.peer_evidence, per_user.peer_headcount
FROM gated
JOIN per_user ON per_user.user_id = gated.user_id;
