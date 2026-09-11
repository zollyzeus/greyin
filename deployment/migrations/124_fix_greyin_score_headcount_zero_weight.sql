-- 123 fixed the per-pillar score going NULL on a NULL cached mean, but
-- missed a second instance of the exact same bug class one level up:
-- platform_composite/greyin_score weight each pillar by
-- ln(headcount + 1), and a pillar's cached headcount is also 0 whenever
-- it has zero evidence as of the last periodic refresh -- ln(0+1) = 0,
-- so a just-fixed, real, non-null pillar score still contributes ZERO
-- weight to the composite. Confirmed live: after 123, the saltnpepper
-- test user showed saltnpepper_score=80 (correct) but
-- platform_composite/greyin_score still NULL, because that was their
-- only pillar and its weight came out to ln(1)=0, making the weighted
-- sum's denominator 0 (NULLIF(0,0) = NULL). Same root cause, same fix
-- shape as 123: a user's own evidence means they ARE part of that
-- pillar's population even if the cached headcount hasn't caught up
-- yet, so per_user's exposed headcount is now
-- GREATEST(cached_headcount, 1 if this user has evidence else 0) --
-- the `scored` CTE's formula itself is untouched, it now just receives
-- a headcount that's never wrongly 0 for someone who actually has a score.
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
    CASE
      WHEN i.stackworks_evidence IS NULL THEN NULL::numeric
      WHEN m.stackworks_mean IS NULL THEN round(i.stackworks_raw)
      ELSE round(i.stackworks_evidence::numeric / (i.stackworks_evidence + c.m_stackworks)::numeric * i.stackworks_raw + c.m_stackworks::numeric / (i.stackworks_evidence + c.m_stackworks)::numeric * m.stackworks_mean)
    END AS stackworks_score,
    i.flexpro_evidence AS flexpro_evidence,
    i.flexpro_raw AS flexpro_raw,
    CASE
      WHEN i.flexpro_evidence IS NULL THEN NULL::numeric
      WHEN m.flexpro_mean IS NULL THEN round(i.flexpro_raw)
      ELSE round(i.flexpro_evidence::numeric / (i.flexpro_evidence + c.m_flexpro)::numeric * i.flexpro_raw + c.m_flexpro::numeric / (i.flexpro_evidence + c.m_flexpro)::numeric * m.flexpro_mean)
    END AS flexpro_score,
    i.saltnpepper_evidence::bigint AS saltnpepper_evidence,
    i.saltnpepper_raw AS saltnpepper_raw,
    CASE
      WHEN i.saltnpepper_evidence IS NULL THEN NULL::numeric
      WHEN m.saltnpepper_mean IS NULL THEN round(i.saltnpepper_raw)
      ELSE round(i.saltnpepper_evidence::numeric / (i.saltnpepper_evidence + c.m_saltnpepper)::numeric * i.saltnpepper_raw + c.m_saltnpepper::numeric / (i.saltnpepper_evidence + c.m_saltnpepper)::numeric * m.saltnpepper_mean)
    END AS saltnpepper_score,
    i.greymatters_evidence::bigint AS greymatters_evidence,
    i.greymatters_raw AS greymatters_raw,
    CASE
      WHEN i.greymatters_evidence IS NULL THEN NULL::numeric
      WHEN m.greymatters_mean IS NULL THEN round(i.greymatters_raw)
      ELSE round(i.greymatters_evidence::numeric / (i.greymatters_evidence + c.m_greymatters)::numeric * i.greymatters_raw + c.m_greymatters::numeric / (i.greymatters_evidence + c.m_greymatters)::numeric * m.greymatters_mean)
    END AS greymatters_score,
    i.peer_evidence::bigint AS peer_evidence,
    i.peer_raw AS peer_raw,
    CASE
      WHEN i.peer_evidence IS NULL THEN NULL::numeric
      WHEN m.peer_mean IS NULL THEN round(i.peer_raw)
      ELSE round(i.peer_evidence::numeric / (i.peer_evidence + c.m_peer)::numeric * i.peer_raw + c.m_peer::numeric / (i.peer_evidence + c.m_peer)::numeric * m.peer_mean)
    END AS peer_score,
    GREATEST(m.stackworks_headcount, CASE WHEN i.stackworks_evidence IS NOT NULL THEN 1 ELSE 0 END) AS stackworks_headcount,
    GREATEST(m.flexpro_headcount, CASE WHEN i.flexpro_evidence IS NOT NULL THEN 1 ELSE 0 END) AS flexpro_headcount,
    GREATEST(m.saltnpepper_headcount, CASE WHEN i.saltnpepper_evidence IS NOT NULL THEN 1 ELSE 0 END) AS saltnpepper_headcount,
    GREATEST(m.greymatters_headcount, CASE WHEN i.greymatters_evidence IS NOT NULL THEN 1 ELSE 0 END) AS greymatters_headcount,
    GREATEST(m.peer_headcount, CASE WHEN i.peer_evidence IS NOT NULL THEN 1 ELSE 0 END) AS peer_headcount
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
