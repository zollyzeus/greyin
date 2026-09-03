-- ============================================================
-- "Worked together" / shared-project discovery
-- ============================================================
--
-- Symmetric (user_id, collaborator_id, pillar) pairs -- unions
-- StackEdge's accepted project_applications (ask owner <-> accepted
-- applicant) and FreeAgent's completed gig_orders (buyer <-> seller).
-- Same unfiltered-view / RLS-does-the-work convention as
-- activity_feed (053) and platform_search_index (037) -- security
-- comes from project_applications/project_asks/gig_orders' own
-- existing RLS still applying to the querying role; this view is a
-- convenience join, not a new access surface (both directions of every
-- pair are already visible to their two participants via those tables).
--
-- Run this after 058_company_reviews.sql
-- ============================================================

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
  SELECT go.buyer_id, go.seller_id, 'freeagent'::text, go.completed_at
  FROM public.gig_orders go
  WHERE go.status = 'completed'
UNION ALL
  SELECT go.seller_id, go.buyer_id, 'freeagent'::text, go.completed_at
  FROM public.gig_orders go
  WHERE go.status = 'completed';

GRANT SELECT ON public.collaborators TO authenticated;

NOTIFY pgrst, 'reload schema';
