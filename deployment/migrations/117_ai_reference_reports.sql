-- AI moat roadmap item: AI-synthesized reference reports (pitch-deck
-- review, 2026-09-01). Summarizes an employer's multiple raw referee
-- responses for one candidate (professional_references/reference_requests/
-- reference_responses, migration 065) into one consistency-flagged report,
-- reusing the existing complete()/llm_feature_flags pattern (048) rather
-- than a new subsystem.
--
-- Confidential like the raw responses it summarizes: reference_responses'
-- own RLS never lets the candidate read a referee's response, only the
-- requesting employer and the responder themselves -- this report follows
-- the same rule, visible only to the requesting employer (and admins),
-- never the candidate.

CREATE TABLE ai_reference_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response_count integer NOT NULL,
  consistency text NOT NULL CHECK (consistency IN ('consistent', 'notable_differences')),
  summary text NOT NULL,
  notes text,
  provider text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, requested_by)
);

CREATE INDEX idx_ai_reference_reports_requested_by ON ai_reference_reports(requested_by);

ALTER TABLE ai_reference_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesting employer can view their own reference report"
  ON ai_reference_reports FOR SELECT
  USING (auth.uid() = requested_by);

CREATE POLICY "Admins manage AI reference reports"
  ON ai_reference_reports FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

INSERT INTO llm_feature_flags (feature_key, enabled)
VALUES ('deepedge_reference_synthesis', true)
ON CONFLICT (feature_key) DO NOTHING;
