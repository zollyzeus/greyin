-- ============================================================
-- Demo-data master script (2026-09-07, consolidated)
-- ============================================================
--
-- Supersedes the original same-named file from earlier the same day.
-- That first pass (Phase 1-8 below) closed 16 features that would have
-- rendered completely empty in a live demo. A follow-up pitch-demo
-- scrutiny pass then found real gaps IN that first pass itself -- a
-- stale denormalized counter, one notification that didn't actually
-- satisfy its own feature's matching threshold, a fabricated audit-log
-- backfill that turned out to target the wrong "eligible pool" column
-- entirely, self-deprecating cover-letter phrasing, and ~380 accumulated
-- Playwright e2e accounts still mixed into every directory/listing
-- alongside the deliberately curated cast. This version folds every one
-- of those fixes in as the correct first draft, not a patch on top of a
-- patch -- running this file once produces the final state directly.
--
-- PREREQUISITE (not done by this file -- creating an auth.users row
-- needs GoTrue's Admin API, not plain SQL): the curated cast below must
-- already exist. That's 11 candidates, 10 employers, 2 GreyMatters
-- authors, and 9 unaffiliated "member" personas, all @demo.greyin.internal,
-- created via POST /auth/v1/admin/users (email_confirm:true,
-- user_metadata: {first_name, last_name, role, years_experience}) --
-- exactly how e2e's own adminCreateAndConfirmUser() provisions an
-- account, just done once by hand instead of per test run. If a fresh
-- environment has none of them yet, create all 32 that way first (their
-- real full_name/skills/current_title/experience_years, set afterward
-- via UPDATE candidates/profiles, are what make each one specific enough
-- to reference below -- see PHASE 0.5).
--
-- Run directly against prod via:
--   docker exec -i $(docker ps --filter name=supabase_supabase_db -q) \
--     psql -U postgres -d postgres -f deployment/seed-demo-data.sql
-- (postgres superuser, bypasses RLS the same way the service-role key
-- does -- there is no "seeding user" session to fake).
--
-- Deliberately NOT covered here, and why: cross_pillar_reciprocity_flags
-- (Phase D1's fraud-detection view) is left genuinely empty on purpose --
-- it exists to flag a REAL suspicious cross-pillar favor-trading pattern,
-- and manufacturing one between two curated (if fictional) people would
-- misrepresent a trust & safety feature's own real output, not just fill
-- a display gap; its own correctness is already proven by
-- ai-cross-pillar-fraud-detection.spec.ts's controlled positive+negative
-- cases. ai_match_audit_log is likewise never hand-inserted here -- see
-- PHASE 8's own note on driving the real matching pipeline instead.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- PHASE 0: Remove accumulated e2e/diagnostic test accounts
-- ------------------------------------------------------------
-- Every account NOT in the curated @demo.greyin.internal cast and NOT a
-- real known account gets removed, along with everything that cascades
-- from it (profiles/candidates/companies/jobs/gigs/discussions/orders/...
-- via ON DELETE CASCADE from profiles). Update the NOT IN list below to
-- match your own real accounts before ever running this against a
-- database that has any -- it is the one list standing between this
-- phase and deleting a real user.
--
-- A handful of tables reference profiles/auth.users with NO ACTION (not
-- CASCADE), so they're cleared or nulled explicitly first or the DELETE
-- below fails outright: future_role_subscriptions and posts.author_id
-- (a real FK, but posts.author_id itself is ON DELETE SET NULL -- deleted
-- explicitly here instead, so a departed test account doesn't leave a
-- literal "E2E ..."-titled post orphaned with a null author).
-- Separately, four evidence tables (verified_outcomes, reputation_events,
-- ai_quality_scores, peer_project_ratings) each carry an AFTER DELETE
-- trigger (122) that re-upserts greyin_score_inputs keyed on THAT ROW's
-- own subject/user id -- deleting them here, before the cascade from
-- auth.users reaches them, means each trigger still finds its subject's
-- profiles row in place when it fires. Deleting them only via the
-- auth.users cascade (skipping this step) fails with a foreign-key
-- violation on greyin_score_inputs, since the cascade can reach profiles
-- before it reaches these tables within the same statement.
CREATE TEMP TABLE doomed_users AS
SELECT id, email FROM auth.users
WHERE email NOT LIKE '%@demo.greyin.internal'
  AND email NOT IN ('admin@greyin.net' /* , add your own real accounts here */);

DELETE FROM public.future_role_subscriptions WHERE user_id IN (SELECT id FROM doomed_users);
DELETE FROM public.posts WHERE author_id IN (SELECT id FROM doomed_users);
UPDATE public.platform_gate_settings SET updated_by = NULL WHERE updated_by IN (SELECT id FROM doomed_users);
UPDATE public.verified_outcomes SET human_reviewed_by = NULL WHERE human_reviewed_by IN (SELECT id FROM doomed_users);
UPDATE public.verified_outcomes SET verified_by = NULL WHERE verified_by IN (SELECT id FROM doomed_users);

DELETE FROM public.verified_outcomes WHERE subject_user_id IN (SELECT id FROM doomed_users);
DELETE FROM public.reputation_events WHERE user_id IN (SELECT id FROM doomed_users);
DELETE FROM public.ai_quality_scores WHERE subject_user_id IN (SELECT id FROM doomed_users);
DELETE FROM public.peer_project_ratings WHERE ratee_id IN (SELECT id FROM doomed_users);

DELETE FROM auth.users WHERE id IN (SELECT id FROM doomed_users);

-- ------------------------------------------------------------
-- PHASE 0.5: One additional permanent persona
-- ------------------------------------------------------------
-- James Kowalski (Engineering Manager, 17 yrs) -- added specifically to
-- complete salary_trends' own k-anonymity floor (HAVING COUNT(*) >= 3,
-- exact match on title+level+location+currency+experience-bucket+quarter)
-- alongside Hannah Kim and Miguel Santos below, WITHOUT contradicting
-- either of their own real curated backgrounds and WITHOUT depending on
-- an ephemeral e2e account (an earlier version of this fix used one --
-- it evaporated the next time Phase 0 ran, breaking salary_trends again).
-- Create via the Admin API first (see the file header), then:
--   UPDATE public.candidates SET
--     skills = ARRAY['Team Leadership','Agile Delivery','Cross-functional Coordination','Technical Mentorship'],
--     current_title = 'Engineering Manager'
--   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'james-kowalski@demo.greyin.internal');
-- His employment-history row is inserted alongside Hannah's and Miguel's
-- in PHASE 2 below (same INSERT, same cluster).

-- ------------------------------------------------------------
-- PHASE 1: DeepEdge applications
-- ------------------------------------------------------------
-- Each of the 10 original curated candidates applies to their closest
-- real open job by background (not always a literal 50%+ skills-string
-- match -- real candidates apply somewhat aspirationally too), spread
-- across every value of applications.status so the review pipeline has
-- something to show at every stage. Cover letters are confident and
-- on-point, never self-flagging their own mismatch (an earlier draft of
-- a few of these read more like a QA test explaining its own fixture
-- data than a real applicant's letter).
INSERT INTO public.applications (id, job_id, candidate_id, status, cover_letter, expected_salary, available_from, applied_at, updated_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', '8a294e32-f5c9-4dca-aab3-8f69bf62289d', '7ce26244-4c28-4f71-ba83-5d4ae728b634', 'interview',
   'I led product strategy and roadmapping for a B2B SaaS platform through a 4x ARR stretch -- this role''s scope maps closely onto that work, and I''d welcome the chance to talk through specifics.',
   210000, CURRENT_DATE + 21, now() - interval '18 days', now() - interval '3 days'),
  ('a0000000-0000-0000-0000-000000000002', 'c4e66766-da3b-43c1-870d-c7c27ab316f4', '4e34d710-ab34-40f4-a3e0-d2eb601126e5', 'interview',
   'I spent the last several years scaling engineering orgs through hypergrowth, including a full re-org I designed and ran myself. Happy to walk through how I''d approach the first 90 days here.',
   240000, CURRENT_DATE + 30, now() - interval '15 days', now() - interval '2 days'),
  ('a0000000-0000-0000-0000-000000000003', '93473270-3855-44d3-ad5a-5eb5b83013dc', 'efd98f9f-dcd0-4e90-94ee-aa7a1e0cb1e1', 'shortlisted',
   'Twenty years in finance leadership, most recently owning FP&A and board reporting through a manufacturing business''s acquisition. This looks like a strong fit for that background.',
   235000, CURRENT_DATE + 14, now() - interval '12 days', now() - interval '4 days'),
  ('a0000000-0000-0000-0000-000000000004', '5ca23051-6ea9-46dd-a1af-75005e4efa86', 'c258b2ac-c060-4474-b4de-fd9ac5bb1106', 'reviewing',
   'I''ve spent my career on the revenue side of the business, closing enterprise deals and then staying close to the account through renewal and expansion -- which in practice means I''ve been doing a lot of what this role owns for years. Happy to walk through specific accounts I''ve turned around.',
   195000, CURRENT_DATE + 30, now() - interval '9 days', now() - interval '9 days'),
  ('a0000000-0000-0000-0000-000000000005', '897fc732-449b-4b39-8012-b628d98b18e0', 'ecd33918-0042-4bc3-8f4f-792c7e6cec07', 'submitted',
   'I''ve led design for products where the roadmap decisions were mine to make jointly with product leadership, not just execute against -- I care as much about what we build as how it looks. Would welcome the chance to talk through how I''d approach this role''s first quarter.',
   180000, CURRENT_DATE + 45, now() - interval '2 days', now() - interval '2 days'),
  ('a0000000-0000-0000-0000-000000000006', 'bb7d13c8-e914-436a-b62e-cade88136a70', '28c9783b-3851-42e5-a3be-a3872d744583', 'offer',
   'I''ve spent most of the last decade on distributed payment infrastructure at staff level -- the system design and mentorship scope here line up closely with what I''m already doing today.',
   215000, CURRENT_DATE + 21, now() - interval '25 days', now() - interval '1 days'),
  ('a0000000-0000-0000-0000-000000000007', '44d8b44d-c62b-44b2-a607-3c9a83dee3b7', 'cc53eb07-2fb4-476d-9634-258bc6dd27a3', 'shortlisted',
   'I''ve built and shipped production ML systems end to end -- from the modeling work through the data pipelines that feed them -- and the rigor required is the same either way. I''d bring that same discipline to this role.',
   205000, CURRENT_DATE + 30, now() - interval '10 days', now() - interval '5 days'),
  ('a0000000-0000-0000-0000-000000000008', 'ab26b15b-35b9-4c07-a8de-bdd8c0e99b74', '364c17c3-0007-4096-870a-b01a50bf5d02', 'accepted',
   'Reliability and incident response have been the core of my last two roles -- I''m excited about this one and glad we found the right fit.',
   200000, CURRENT_DATE + 14, now() - interval '40 days', now() - interval '20 days'),
  ('a0000000-0000-0000-0000-000000000009', '63cfaf5c-1317-47d1-8093-e359d991f974', '650ba05e-90c0-467e-8886-a3b869de478b', 'rejected',
   'I''ve spent my career building and shipping mobile platforms at scale, and the systems-design fundamentals transfer directly -- clean architecture and performance discipline matter the same way regardless of the surface. Excited about the scope here.',
   195000, CURRENT_DATE + 30, now() - interval '22 days', now() - interval '14 days'),
  ('a0000000-0000-0000-0000-00000000000a', '38e4bdad-a857-469b-b8cf-ffbe378007dc', '11c9cf3a-4638-4e82-91ec-c295f315f338', 'withdrawn',
   'My background is backend and distributed systems -- I''ve owned production infrastructure end to end and would bring that same rigor here.',
   NULL, NULL, now() - interval '11 days', now() - interval '6 days'),
  -- Two candidates each apply a second time, giving recommendJobsFromApplicationHistory() a real pattern to reason over.
  ('a0000000-0000-0000-0000-00000000000b', 'b1dc8453-27df-40a1-a105-b5e3300c2fc3', '7ce26244-4c28-4f71-ba83-5d4ae728b634', 'submitted',
   'Applying here as well -- similar scope to my other application, and Meridian''s healthcare-adjacent product work is especially interesting to me.',
   210000, CURRENT_DATE + 21, now() - interval '5 days', now() - interval '5 days'),
  ('a0000000-0000-0000-0000-00000000000c', '71050bf5-c7ce-4a6f-81ea-29af56715327', '4e34d710-ab34-40f4-a3e0-d2eb601126e5', 'submitted',
   'A second Director of Engineering opening that matches my background -- keeping my options open while the Ironwood process continues.',
   240000, CURRENT_DATE + 30, now() - interval '4 days', now() - interval '4 days')
ON CONFLICT (job_id, candidate_id) DO NOTHING;

-- ------------------------------------------------------------
-- PHASE 2: Cascading DeepEdge features that gate on a real application
-- ------------------------------------------------------------

-- Company reviews (058) -- gated on a real application at that company.
INSERT INTO public.company_reviews (company_id, reviewer_id, rating, review_text) VALUES
  ('ed21b453-0583-4074-98bf-b564d1a7ca5b', '3bddb1a4-dc65-4786-af29-93aa1515bd5c', 5, 'Fast, transparent process end to end -- clear scope in the first call, a real technical conversation in the loop, and an offer within two weeks of applying.'),
  ('9381d957-ad46-4dbf-ad1f-b8d2683d8b7d', 'fa700248-dd35-4c20-b674-7d741e9f8620', 4, 'Thoughtful interview panel and a genuinely hard product case study, which I appreciated. Communication between rounds could have been a little faster.'),
  ('93bd0eee-4439-4d86-97d9-a7fc40e5d995', 'c7cb9a4a-34cc-4be6-9f26-6c4ebb0b184c', 5, 'The hiring manager clearly understood the role at a technical level -- no vague buzzword screening, just a real conversation about the systems I''d actually be owning.')
ON CONFLICT (company_id, reviewer_id) DO NOTHING;

-- Professional references (065) -- two candidates list a real colleague
-- from their own cast.
INSERT INTO public.professional_references (id, candidate_id, reference_user_id, relationship_type, relationship_detail) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'fa700248-dd35-4c20-b674-7d741e9f8620', 'a1b29015-1a85-451a-9efb-7ea534d29ec1', 'ex_colleague', 'Worked jointly on product and design strategy for two years at a previous company; Naomi led design while I led product.'),
  ('b0000000-0000-0000-0000-000000000002', 'c1287989-485d-4e33-a1ab-184218736d5f', 'c7cb9a4a-34cc-4be6-9f26-6c4ebb0b184c', 'ex_colleague', 'Miguel reported to me as a senior engineer for three years; he was one of the strongest systems thinkers on the team.')
ON CONFLICT (candidate_id, reference_user_id) DO NOTHING;

-- Reference requests (065) -- an employer with a real application from
-- that candidate requests the reference; one already responded, one
-- still pending, to show both queue states.
INSERT INTO public.reference_requests (id, reference_id, requested_by, application_id, status) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '711d4112-45a7-42f5-a07f-6fc066055b21', 'a0000000-0000-0000-0000-000000000001', 'responded'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '711d4112-45a7-42f5-a07f-6fc066055b21', 'a0000000-0000-0000-0000-000000000002', 'pending')
ON CONFLICT (reference_id, application_id) DO NOTHING;

INSERT INTO public.reference_responses (request_id, responder_id, body) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a1b29015-1a85-451a-9efb-7ea534d29ec1', 'Isabelle was consistently the most rigorous product thinker on our team -- she pushed back on scope constructively and her roadmap calls held up well over time. I''d work with her again without hesitation.')
ON CONFLICT (request_id) DO NOTHING;

-- Job alerts (023) -- a few candidates watching for more of what they're seeing.
INSERT INTO public.job_alerts (user_id, keywords, location) VALUES
  ('55735a1e-aea4-4761-88c1-df8cb600cbb1', 'machine learning, MLOps, risk modeling', 'Remote'),
  ('4c0b35b9-b969-44c7-abdc-aa09dc34e4ef', 'iOS, mobile architecture', 'Remote'),
  ('6ffb6dc3-e082-4c69-835c-c866f6de5ef5', 'backend, distributed systems, Java', NULL),
  ('a1b29015-1a85-451a-9efb-7ea534d29ec1', 'design leadership, design systems', 'Remote');

-- Candidate employment history (055) -- feeds both the résumé display
-- and the salary_trends "past" source. The Engineering Manager / senior
-- / Remote / USD / Q2-2025 cluster (Hannah Kim, Miguel Santos, James
-- Kowalski -- PHASE 0.5) deliberately shares every one of
-- salary_trends' own grouping keys, INCLUDING the experience bucket
-- (all three are 15+ years) -- a first attempt clustered on title/level/
-- location/quarter alone and missed that experience bucket is ALSO a
-- grouping key, so a lower-experience person in the "right" title still
-- failed to clear the k-anonymity floor (HAVING COUNT(*) >= 3).
INSERT INTO public.candidate_employment_history (candidate_id, title, company, location, level, start_date, end_date, is_current, salary_amount, currency) VALUES
  ('4e34d710-ab34-40f4-a3e0-d2eb601126e5', 'Engineering Manager', 'Northstar Systems', 'Remote', 'senior', '2021-02-01', '2025-06-20', false, 185000, 'USD'),
  ('28c9783b-3851-42e5-a3be-a3872d744583', 'Engineering Manager', 'Vantage Cloud', 'Remote', 'senior', '2020-09-01', '2025-06-10', false, 165000, 'USD'),
  -- James Kowalski's candidate_id -- look up via his known demo email if re-running fresh:
  -- (SELECT c.id FROM public.candidates c JOIN public.profiles p ON p.id=c.user_id WHERE p.id=(SELECT id FROM auth.users WHERE email='james-kowalski@demo.greyin.internal'))
  ('2ee6773f-01e1-4d3e-9f9b-0a4fae50e6a8', 'Engineering Manager', 'Cobalt Systems', 'Remote', 'senior', '2019-03-01', '2025-06-15', false, 178000, 'USD'),
  ('efd98f9f-dcd0-4e90-94ee-aa7a1e0cb1e1', 'Senior Finance Director', 'Meridian Manufacturing Co.', 'Chicago, IL', 'director', '2016-03-01', '2024-12-15', false, 225000, 'USD'),
  ('c258b2ac-c060-4474-b4de-fd9ac5bb1106', 'Director of Sales', 'Harborlight Software', 'Austin, TX', 'director', '2014-01-01', '2017-05-01', false, 165000, 'USD'),
  ('ecd33918-0042-4bc3-8f4f-792c7e6cec07', 'Head of Design', 'Lumen Studio', 'Remote', 'director', '2018-01-01', '2024-11-01', false, 175000, 'USD'),
  ('7ce26244-4c28-4f71-ba83-5d4ae728b634', 'Director of Product', 'Vellum Health', 'Boston, MA', 'director', '2019-04-01', '2025-01-10', false, 195000, 'USD'),
  ('cc53eb07-2fb4-476d-9634-258bc6dd27a3', 'Principal Data Scientist', 'Ashford Risk Analytics', 'New York, NY', 'lead', '2018-08-01', '2024-10-01', false, 180000, 'USD'),
  ('364c17c3-0007-4096-870a-b01a50bf5d02', 'Senior SRE', 'Beacon Cloud', 'Remote', 'senior', '2020-01-01', '2025-02-01', false, 175000, 'USD'),
  ('650ba05e-90c0-467e-8886-a3b869de478b', 'Senior iOS Engineer', 'Orbital Mobile', 'Seattle, WA', 'senior', '2019-07-01', '2025-03-01', false, 168000, 'USD'),
  ('11c9cf3a-4638-4e82-91ec-c295f315f338', 'Senior Backend Engineer', 'Kestrel Data', 'Remote', 'senior', '2019-11-01', '2025-06-25', false, 170000, 'USD')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- PHASE 3: Cross-pillar collaboration signals, built on real
-- collaborator pairs (a real completed FlexPro order already links
-- them) rather than invented relationships.
-- ------------------------------------------------------------

INSERT INTO public.skill_endorsements (endorser_id, endorsee_id, skill) VALUES
  ('4c2bb048-9ccb-4660-9014-053790a65863', 'c1287989-485d-4e33-a1ab-184218736d5f', 'Engineering Leadership'),
  ('618987bb-bd81-447b-923c-52f983a20279', 'c1287989-485d-4e33-a1ab-184218736d5f', 'Systems Architecture'),
  ('68a2f9e7-3c87-4012-84b9-4ae5f3998502', 'a753f3ed-135f-4174-9d62-fcd00eaf09d1', 'Financial Modeling'),
  ('68a2f9e7-3c87-4012-84b9-4ae5f3998502', '55735a1e-aea4-4761-88c1-df8cb600cbb1', 'Machine Learning'),
  ('2b599920-0a22-485d-b969-58eaaf958911', '4c0b35b9-b969-44c7-abdc-aa09dc34e4ef', 'iOS'),
  ('b0d9efab-1766-48bf-881a-20f2a4ad6a63', 'fa700248-dd35-4c20-b674-7d741e9f8620', 'Product Strategy'),
  ('711d4112-45a7-42f5-a07f-6fc066055b21', 'fa700248-dd35-4c20-b674-7d741e9f8620', 'User Research'),
  ('763b1af7-80bc-48bc-b55f-261637802507', '3bddb1a4-dc65-4786-af29-93aa1515bd5c', 'Incident Response'),
  ('cf5db932-95a1-4a10-a2ae-00ec0658beb6', 'c7cb9a4a-34cc-4be6-9f26-6c4ebb0b184c', 'Kubernetes'),
  ('ec37f634-2151-40a0-a62c-96301bc61a54', 'a1b29015-1a85-451a-9efb-7ea534d29ec1', 'Design Systems')
ON CONFLICT DO NOTHING;

INSERT INTO public.skill_ratings (rater_id, ratee_id, skill, rating, stage, gig_order_id) VALUES
  ('cf5db932-95a1-4a10-a2ae-00ec0658beb6', 'a1b29015-1a85-451a-9efb-7ea534d29ec1', 'Design Systems', 5, 'verified', '6ebd7548-2ca0-4e2e-8330-c79e3fc52b7c'),
  ('cf5db932-95a1-4a10-a2ae-00ec0658beb6', 'c7cb9a4a-34cc-4be6-9f26-6c4ebb0b184c', 'Kubernetes', 5, 'verified', 'cf9ee784-c6a8-4258-ab2a-508d7569f8f4'),
  ('ec37f634-2151-40a0-a62c-96301bc61a54', 'a1b29015-1a85-451a-9efb-7ea534d29ec1', 'Figma', 4, 'verified', '9c048fcb-c0e2-46de-a79d-fec625dbcf1e'),
  ('4c2bb048-9ccb-4660-9014-053790a65863', 'c1287989-485d-4e33-a1ab-184218736d5f', 'Engineering Leadership', 5, 'verified', '5b365740-4779-4c8a-8ded-ea6f6789df69'),
  ('618987bb-bd81-447b-923c-52f983a20279', '6ffb6dc3-e082-4c69-835c-c866f6de5ef5', 'System Design', 5, 'verified', '8cf5accb-44a4-4f2e-904f-84adac0e17a5'),
  ('68a2f9e7-3c87-4012-84b9-4ae5f3998502', 'a753f3ed-135f-4174-9d62-fcd00eaf09d1', 'Financial Modeling', 5, 'verified', '610e676e-95ff-4723-807f-4fcf0e82729f'),
  ('2b599920-0a22-485d-b969-58eaaf958911', '55735a1e-aea4-4761-88c1-df8cb600cbb1', 'Machine Learning', 4, 'verified', '05d1fb3e-3286-4a9e-a380-4a9934476d7f'),
  ('763b1af7-80bc-48bc-b55f-261637802507', '3bddb1a4-dc65-4786-af29-93aa1515bd5c', 'Terraform', 5, 'verified', 'a54de0af-e5cd-45bb-bb90-402f3ae574f9')
ON CONFLICT DO NOTHING;

INSERT INTO public.written_recommendations (recommender_id, recommendee_id, body, status) VALUES
  ('4c2bb048-9ccb-4660-9014-053790a65863', 'c1287989-485d-4e33-a1ab-184218736d5f', 'Hannah rebuilt our platform team''s roadmap process from scratch and it stuck long after the engagement ended. Rare combination of technical depth and genuine org-design skill.', 'approved'),
  ('618987bb-bd81-447b-923c-52f983a20279', '6ffb6dc3-e082-4c69-835c-c866f6de5ef5', 'Greta redesigned our event pipeline under real production load with zero downtime. Meticulous, communicates clearly, delivers on time.', 'approved'),
  ('68a2f9e7-3c87-4012-84b9-4ae5f3998502', 'a753f3ed-135f-4174-9d62-fcd00eaf09d1', 'Benjamin''s financial modeling work directly informed a board-level decision that turned out to be right. I''d bring him back for any high-stakes finance engagement.', 'approved'),
  ('b0d9efab-1766-48bf-881a-20f2a4ad6a63', 'fa700248-dd35-4c20-b674-7d741e9f8620', 'Isabelle ran a full product discovery cycle for us in six weeks that most teams would take a quarter on, and the output held up in market.', 'pending'),
  ('763b1af7-80bc-48bc-b55f-261637802507', '3bddb1a4-dc65-4786-af29-93aa1515bd5c', 'Thomas cut our incident MTTR by more than half inside two months. Calm under real production pressure, which is rarer than it should be.', 'approved')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- PHASE 4: StackWorks project upvotes -- also feeds greyin_scores'
-- stackworks_evidence input via the trigger on this table (122).
-- ------------------------------------------------------------
INSERT INTO public.project_upvotes (project_id, user_id) VALUES
  ('0d47acaa-e146-40cc-800c-c9968b37ee02', 'e5f360e8-ffd0-4485-884b-60bdaa6005ce'),
  ('0d47acaa-e146-40cc-800c-c9968b37ee02', '89018def-f57b-42ac-b2d1-2454b52d4e2d'),
  ('0d47acaa-e146-40cc-800c-c9968b37ee02', '8ae84b1b-3ef7-47e6-8c0c-15fcc444916c'),
  ('dda8e85e-839e-40fc-89f2-f590785027e3', '79ccff14-a4e0-4242-9dc7-14c9873df8f9'),
  ('dda8e85e-839e-40fc-89f2-f590785027e3', 'cc51488a-adb7-4f36-b17d-8cc5639a4328'),
  ('edc656b9-0932-47a0-87cf-c4ed1ef55004', '6d6ceb53-eb38-4d89-9fd3-c455f2cf3632'),
  ('edc656b9-0932-47a0-87cf-c4ed1ef55004', '8ec6d1bd-e255-41a6-806e-7f7fd0332250'),
  ('edc656b9-0932-47a0-87cf-c4ed1ef55004', 'e5f360e8-ffd0-4485-884b-60bdaa6005ce'),
  ('5a2bda70-3a95-4462-8a52-6bb83f2fde13', '8ae84b1b-3ef7-47e6-8c0c-15fcc444916c'),
  ('5a2bda70-3a95-4462-8a52-6bb83f2fde13', '89018def-f57b-42ac-b2d1-2454b52d4e2d'),
  ('3fcb1397-3673-4b03-ab92-f7588e97cf02', 'cc51488a-adb7-4f36-b17d-8cc5639a4328'),
  ('3fcb1397-3673-4b03-ab92-f7588e97cf02', '79ccff14-a4e0-4242-9dc7-14c9873df8f9'),
  ('3fcb1397-3673-4b03-ab92-f7588e97cf02', '6d6ceb53-eb38-4d89-9fd3-c455f2cf3632'),
  ('fa77b663-13e3-4697-a651-7b52d73b6334', '8ec6d1bd-e255-41a6-806e-7f7fd0332250'),
  ('fa77b663-13e3-4697-a651-7b52d73b6334', 'e5f360e8-ffd0-4485-884b-60bdaa6005ce')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- PHASE 4.5: Peer-confirmed projects (089) -- real project + a real
-- confirmed collaborator + mutual ratings, all on curated candidates.
-- ------------------------------------------------------------
INSERT INTO public.peer_projects (id, creator_id, title, company, description, started_on, ended_on) VALUES
  ('11100000-0000-0000-0000-000000000001', 'c1287989-485d-4e33-a1ab-184218736d5f', 'Platform migration to Kubernetes', 'Northstar Systems', 'Led the migration of a monolithic deployment pipeline onto Kubernetes, cutting deploy time from 40 minutes to under 5.', '2024-02-01', '2024-09-30'),
  ('11100000-0000-0000-0000-000000000002', 'fa700248-dd35-4c20-b674-7d741e9f8620', 'Enterprise onboarding redesign', 'Vellum Health', 'Rebuilt the enterprise customer onboarding flow end to end, cutting time-to-first-value from 3 weeks to 4 days.', '2023-11-01', '2024-04-15'),
  ('11100000-0000-0000-0000-000000000003', '3bddb1a4-dc65-4786-af29-93aa1515bd5c', 'Incident response overhaul', 'Beacon Cloud', 'Redesigned the on-call and incident-response process after a string of prolonged outages -- MTTR dropped by more than half.', '2024-05-01', '2024-11-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.peer_project_members (project_id, user_id, status, responded_at) VALUES
  ('11100000-0000-0000-0000-000000000001', 'c7cb9a4a-34cc-4be6-9f26-6c4ebb0b184c', 'confirmed', now() - interval '20 days'),
  ('11100000-0000-0000-0000-000000000002', 'a1b29015-1a85-451a-9efb-7ea534d29ec1', 'confirmed', now() - interval '15 days'),
  ('11100000-0000-0000-0000-000000000003', '6ffb6dc3-e082-4c69-835c-c866f6de5ef5', 'confirmed', now() - interval '10 days')
ON CONFLICT (project_id, user_id) DO NOTHING;

INSERT INTO public.peer_project_ratings (project_id, rater_id, ratee_id, contribution_rating) VALUES
  ('11100000-0000-0000-0000-000000000001', 'c1287989-485d-4e33-a1ab-184218736d5f', 'c7cb9a4a-34cc-4be6-9f26-6c4ebb0b184c', 5),
  ('11100000-0000-0000-0000-000000000001', 'c7cb9a4a-34cc-4be6-9f26-6c4ebb0b184c', 'c1287989-485d-4e33-a1ab-184218736d5f', 5),
  ('11100000-0000-0000-0000-000000000002', 'fa700248-dd35-4c20-b674-7d741e9f8620', 'a1b29015-1a85-451a-9efb-7ea534d29ec1', 4),
  ('11100000-0000-0000-0000-000000000002', 'a1b29015-1a85-451a-9efb-7ea534d29ec1', 'fa700248-dd35-4c20-b674-7d741e9f8620', 5),
  ('11100000-0000-0000-0000-000000000003', '3bddb1a4-dc65-4786-af29-93aa1515bd5c', '6ffb6dc3-e082-4c69-835c-c866f6de5ef5', 5),
  ('11100000-0000-0000-0000-000000000003', '6ffb6dc3-e082-4c69-835c-c866f6de5ef5', '3bddb1a4-dc65-4786-af29-93aa1515bd5c', 4)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- PHASE 5: Mentor sessions (056) -- core 1:1 flow, plus 062's cohort/
-- package/recording-resale monetization breadth (only the core flow
-- shipped in the first pass of this file).
-- ------------------------------------------------------------
UPDATE public.profiles SET is_mentor = true WHERE id IN ('c1287989-485d-4e33-a1ab-184218736d5f', 'fa700248-dd35-4c20-b674-7d741e9f8620');

INSERT INTO public.gigs (id, freelancer_id, title, slug, description, category_id, pricing_type, price_min, price_max, delivery_days, is_mentor_session, status) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c1287989-485d-4e33-a1ab-184218736d5f', 'Engineering leadership 1:1 mentoring', 'engineering-leadership-1-1-mentoring', '45-minute 1:1 session on scaling an engineering org, technical leadership transitions, or a specific org-design problem you''re facing right now.', '7eb707d9-2d36-4886-9904-e3e03fd310f8', 'fixed', 4000, 4000, 1, true, 'active'),
  ('d0000000-0000-0000-0000-000000000002', 'fa700248-dd35-4c20-b674-7d741e9f8620', 'Product strategy office hours', 'product-strategy-office-hours', '45-minute 1:1 session on product strategy, roadmap prioritization, or breaking into a Director of Product role.', '7eb707d9-2d36-4886-9904-e3e03fd310f8', 'fixed', 3500, 3500, 1, true, 'active')
ON CONFLICT (id) DO NOTHING;

-- One completed, paid, past 1:1 session (with a real linked order) --
-- inserted directly rather than through book_mentor_slot() (which
-- requires a live auth.uid() session this seed script has none of).
INSERT INTO public.gig_orders (id, gig_id, buyer_id, seller_id, amount, currency, status, payment_status, paid_at, completed_at) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '618987bb-bd81-447b-923c-52f983a20279', 'c1287989-485d-4e33-a1ab-184218736d5f', 4000, 'INR', 'completed', 'captured', now() - interval '9 days', now() - interval '8 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mentor_session_slots (id, gig_id, mentor_id, starts_at, ends_at, status, gig_order_id) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'c1287989-485d-4e33-a1ab-184218736d5f', now() - interval '9 days', now() - interval '9 days' + interval '45 minutes', 'booked', 'e0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'c1287989-485d-4e33-a1ab-184218736d5f', now() + interval '4 days', now() + interval '4 days' + interval '45 minutes', 'open', NULL),
  ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'fa700248-dd35-4c20-b674-7d741e9f8620', now() + interval '6 days', now() + interval '6 days' + interval '45 minutes', 'open', NULL)
ON CONFLICT (id) DO NOTHING;

-- 062 breadth: a cohort/group slot on Hannah Kim's gig, 2 of 3 seats booked.
INSERT INTO public.mentor_session_slots (id, gig_id, mentor_id, starts_at, ends_at, status, capacity, booked_count) VALUES
  ('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'c1287989-485d-4e33-a1ab-184218736d5f', now() + interval '10 days', now() + interval '10 days' + interval '60 minutes', 'open', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mentor_session_bookings (slot_id, buyer_id) VALUES
  ('f0000000-0000-0000-0000-000000000004', '711d4112-45a7-42f5-a07f-6fc066055b21'),
  ('f0000000-0000-0000-0000-000000000004', '618987bb-bd81-447b-923c-52f983a20279')
ON CONFLICT (slot_id, buyer_id) DO NOTHING;

-- A session-bundle package on Isabelle Moreau's gig, purchased and
-- partially redeemed (bought 3, used 1 -- against her own open slot
-- f0000000...0003 above, which this marks booked); one fresh open slot
-- added so there's still real bookable availability on her gig too.
INSERT INTO public.mentor_packages (id, mentor_id, gig_id, title, session_count, price, currency, description) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'fa700248-dd35-4c20-b674-7d741e9f8620', 'd0000000-0000-0000-0000-000000000002', '3-Session Product Strategy Bundle', 3, 9000, 'INR', 'Three 45-minute sessions at a discount to the single-session rate -- for anyone working through a real roadmap decision over several weeks.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.gig_orders (id, gig_id, buyer_id, seller_id, amount, currency, status, payment_status, paid_at) VALUES
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'b0d9efab-1766-48bf-881a-20f2a4ad6a63', 'fa700248-dd35-4c20-b674-7d741e9f8620', 9000, 'INR', 'paid', 'captured', now() - interval '12 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mentor_package_purchases (id, package_id, buyer_id, gig_order_id, sessions_remaining) VALUES
  ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'b0d9efab-1766-48bf-881a-20f2a4ad6a63', 'e0000000-0000-0000-0000-000000000002', 2)
ON CONFLICT (id) DO NOTHING;

UPDATE public.mentor_session_slots SET status = 'booked', booked_count = 1 WHERE id = 'f0000000-0000-0000-0000-000000000003';
INSERT INTO public.mentor_session_bookings (slot_id, buyer_id, package_purchase_id) VALUES
  ('f0000000-0000-0000-0000-000000000003', 'b0d9efab-1766-48bf-881a-20f2a4ad6a63', 'd2000000-0000-0000-0000-000000000001')
ON CONFLICT (slot_id, buyer_id) DO NOTHING;

INSERT INTO public.mentor_session_slots (id, gig_id, mentor_id, starts_at, ends_at, status) VALUES
  ('f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 'fa700248-dd35-4c20-b674-7d741e9f8620', now() + interval '9 days', now() + interval '9 days' + interval '45 minutes', 'open')
ON CONFLICT (id) DO NOTHING;

-- 062 breadth: recording resale on Hannah Kim's already-completed session.
UPDATE public.mentor_session_slots
SET recording_url = 'https://cdn.greyin.net/recordings/demo-eng-leadership-session.mp4', recording_price = 1500
WHERE id = 'f0000000-0000-0000-0000-000000000001';

INSERT INTO public.gig_orders (id, gig_id, buyer_id, seller_id, amount, currency, status, payment_status, paid_at) VALUES
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', '68a2f9e7-3c87-4012-84b9-4ae5f3998502', 'c1287989-485d-4e33-a1ab-184218736d5f', 1500, 'INR', 'completed', 'captured', now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mentor_recording_purchases (slot_id, buyer_id, gig_order_id) VALUES
  ('f0000000-0000-0000-0000-000000000001', '68a2f9e7-3c87-4012-84b9-4ae5f3998502', 'e0000000-0000-0000-0000-000000000003')
ON CONFLICT (slot_id, buyer_id) DO NOTHING;

-- ------------------------------------------------------------
-- PHASE 6: Platform-wide
-- ------------------------------------------------------------

INSERT INTO public.user_follows (follower_id, followed_id) VALUES
  ('8ae84b1b-3ef7-47e6-8c0c-15fcc444916c', '03c3bf35-9a0b-4a50-a232-dfd1cd8af7af'),
  ('89018def-f57b-42ac-b2d1-2454b52d4e2d', '03c3bf35-9a0b-4a50-a232-dfd1cd8af7af'),
  ('cc51488a-adb7-4f36-b17d-8cc5639a4328', 'c6818f81-3f87-45ef-bf76-1a31f36bfca0'),
  ('79ccff14-a4e0-4242-9dc7-14c9873df8f9', 'c6818f81-3f87-45ef-bf76-1a31f36bfca0'),
  ('e5f360e8-ffd0-4485-884b-60bdaa6005ce', '7b954208-c598-4150-af2c-0cf521271083'),
  ('694de355-f5db-41dd-ad1d-0df54f4dd9ee', '7b954208-c598-4150-af2c-0cf521271083'),
  ('6d6ceb53-eb38-4d89-9fd3-c455f2cf3632', '694de355-f5db-41dd-ad1d-0df54f4dd9ee'),
  ('8ec6d1bd-e255-41a6-806e-7f7fd0332250', '694de355-f5db-41dd-ad1d-0df54f4dd9ee'),
  ('c1287989-485d-4e33-a1ab-184218736d5f', 'fa700248-dd35-4c20-b674-7d741e9f8620'),
  ('fa700248-dd35-4c20-b674-7d741e9f8620', 'c1287989-485d-4e33-a1ab-184218736d5f')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_fr1 UUID; v_fr2 UUID; v_fr3 UUID;
BEGIN
  INSERT INTO public.feature_requests (user_id, title, description, status) VALUES
    ('8ae84b1b-3ef7-47e6-8c0c-15fcc444916c', 'Bulk-export written recommendations to PDF', 'Would love a one-click way to export the recommendations on my profile for use outside the platform.', 'open')
    RETURNING id INTO v_fr1;
  INSERT INTO public.feature_requests (user_id, title, description, status) VALUES
    ('89018def-f57b-42ac-b2d1-2454b52d4e2d', 'Calendar sync for mentor session slots', 'Google/Outlook calendar sync for booked mentor sessions so they don''t only live inside Greyin.', 'planned')
    RETURNING id INTO v_fr2;
  INSERT INTO public.feature_requests (user_id, title, description, status) VALUES
    ('cc51488a-adb7-4f36-b17d-8cc5639a4328', 'Dark mode for the salary trends charts', 'The salary trend charts are still rendering with a light background even with dark mode on elsewhere.', 'shipped')
    RETURNING id INTO v_fr3;

  INSERT INTO public.feature_request_upvotes (feature_request_id, user_id) VALUES
    (v_fr1, '89018def-f57b-42ac-b2d1-2454b52d4e2d'), (v_fr1, 'e5f360e8-ffd0-4485-884b-60bdaa6005ce'), (v_fr1, '79ccff14-a4e0-4242-9dc7-14c9873df8f9'),
    (v_fr2, '8ae84b1b-3ef7-47e6-8c0c-15fcc444916c'), (v_fr2, '6d6ceb53-eb38-4d89-9fd3-c455f2cf3632'), (v_fr2, 'cc51488a-adb7-4f36-b17d-8cc5639a4328'), (v_fr2, '8ec6d1bd-e255-41a6-806e-7f7fd0332250'),
    (v_fr3, '694de355-f5db-41dd-ad1d-0df54f4dd9ee')
  ON CONFLICT DO NOTHING;
END $$;

INSERT INTO public.platform_feedback (user_id, source_app, rating, message, status, admin_reply, replied_at) VALUES
  ('8ae84b1b-3ef7-47e6-8c0c-15fcc444916c', 'saltnpepper', 4, 'The Lab is a genuinely nice way to see what people are building without it turning into a portfolio-spam feed.', 'open', NULL, NULL),
  ('c7cb9a4a-34cc-4be6-9f26-6c4ebb0b184c', 'deepedge', 5, 'The AI-synthesized profile summary on my candidate page is the first "AI feature" on a job platform that actually felt useful rather than gimmicky.', 'replied', 'Really glad it landed well -- that one took a few iterations to get the tone right. Thank you!', now() - interval '2 days'),
  ('a1b29015-1a85-451a-9efb-7ea534d29ec1', 'flexpro', 3, 'Order messaging is solid but I keep losing track of which thread has an unread reply across multiple active orders.', 'open', NULL, NULL);

-- Discussions/replies -- restored to real, curated-cast volume (not
-- e2e-account volume, which is what Phase 0 above just removed).
INSERT INTO public.discussions (id, author_id, title, body, category) VALUES
  ('22200000-0000-0000-0000-000000000001', '8ae84b1b-3ef7-47e6-8c0c-15fcc444916c', 'How are you all handling on-call burnout on small teams?', 'We''re a 6-person infra team and on-call fatigue is becoming a real retention risk. What''s actually worked for you beyond "hire more people"?', 'career'),
  ('22200000-0000-0000-0000-000000000002', '89018def-f57b-42ac-b2d1-2454b52d4e2d', 'Negotiating a counter-offer without burning the relationship', 'Got a competing offer and want to bring it to my current manager honestly rather than just leaving. Anyone done this well (or badly)?', 'career'),
  ('22200000-0000-0000-0000-000000000003', '6d6ceb53-eb38-4d89-9fd3-c455f2cf3632', 'Is a platform team actually worth it at 40 engineers?', 'Considering spinning up a dedicated platform team. At what size did it actually start paying for itself for you?', 'engineering'),
  ('22200000-0000-0000-0000-000000000004', 'cc51488a-adb7-4f36-b17d-8cc5639a4328', 'Best way to structure a 30-60-90 for a first VP hire', 'Bringing in our first VP-level hire and want their first quarter to actually stick. What made yours work (or not)?', 'leadership')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.discussion_replies (discussion_id, author_id, body) VALUES
  ('22200000-0000-0000-0000-000000000001', '8ec6d1bd-e255-41a6-806e-7f7fd0332250', 'Rotating a "quiet week" in with no on-call duty at all after a bad week helped us more than adding headcount did.'),
  ('22200000-0000-0000-0000-000000000001', 'e5f360e8-ffd0-4485-884b-60bdaa6005ce', 'We started actually paging out low-severity alerts to a daytime-only channel instead of on-call -- cut real 2am pages by more than half.'),
  ('22200000-0000-0000-0000-000000000002', '7b954208-c598-4150-af2c-0cf521271083', 'Led with the offer details up front rather than easing into it -- felt awkward but it was clearly the more respectful version for everyone.'),
  ('22200000-0000-0000-0000-000000000002', '79ccff14-a4e0-4242-9dc7-14c9873df8f9', 'Worked out fine for me once, backfired badly a second time at a different company -- depends a lot on how your manager actually reacts to being "tested."'),
  ('22200000-0000-0000-0000-000000000003', 'cc51488a-adb7-4f36-b17d-8cc5639a4328', 'Around 40-50 for us -- before that the "platform team" was really just one senior engineer doing double duty, which is fine too.'),
  ('22200000-0000-0000-0000-000000000004', '694de355-f5db-41dd-ad1d-0df54f4dd9ee', 'A real, named project they own by day 30 mattered more than any onboarding doc we wrote.')
ON CONFLICT DO NOTHING;

-- GreyMatters comments, author tips, newsletter signups.
INSERT INTO public.comments (post_id, user_id, content, status) VALUES
  ('30e05ebb-1693-4ece-98ad-e45ef6f7a115', '8ae84b1b-3ef7-47e6-8c0c-15fcc444916c', 'This matches my experience exactly -- the postmortem template was never the bottleneck, getting people to actually read each other''s was.', 'approved'),
  ('30e05ebb-1693-4ece-98ad-e45ef6f7a115', 'c1287989-485d-4e33-a1ab-184218736d5f', 'Curious how you handled the case where the "5 whys" kept landing on a org-structure problem nobody wanted to touch.', 'approved'),
  ('e5e2d6e9-264e-4684-af8a-06305e219e7d', '89018def-f57b-42ac-b2d1-2454b52d4e2d', 'The replacement question you describe is so much better at surfacing how someone actually thinks under ambiguity. Stealing this.', 'approved'),
  ('bf22a57f-b8f9-40e8-b068-c3f9caeb61be', 'fa700248-dd35-4c20-b674-7d741e9f8620', 'Made a similar move two years ago -- the hardest part for me wasn''t the skills, it was other people''s assumptions about what I''d gone "back" to.', 'approved'),
  ('2af1c1ed-9846-4565-96b7-a428345c0194', '6d6ceb53-eb38-4d89-9fd3-c455f2cf3632', '"Senior" as a title without a shared rubric behind it has caused more comp arguments on my team than almost anything else. Well put.', 'approved'),
  ('d7256cfe-9948-4138-b9c3-c566726adb46', '6ffb6dc3-e082-4c69-835c-c866f6de5ef5', 'What was the actual trigger point that made the monolith untenable, versus just "it felt like time"?', 'approved'),
  ('5e5c62ee-e6b0-455e-9f0e-5e2baad19534', '8ec6d1bd-e255-41a6-806e-7f7fd0332250', 'The framing of "debt that compounds vs. debt that just sits there" is the clearest version of this argument I''ve read.', 'approved'),
  ('5e5c62ee-e6b0-455e-9f0e-5e2baad19534', 'cc51488a-adb7-4f36-b17d-8cc5639a4328', 'Would love a follow-up post on how you actually prioritized the paydown work against a full product roadmap.', 'approved')
ON CONFLICT DO NOTHING;

INSERT INTO public.author_tips (post_id, author_id, tipper_id, amount, status) VALUES
  ('30e05ebb-1693-4ece-98ad-e45ef6f7a115', '03c3bf35-9a0b-4a50-a232-dfd1cd8af7af', 'c1287989-485d-4e33-a1ab-184218736d5f', 200, 'paid'),
  ('e5e2d6e9-264e-4684-af8a-06305e219e7d', '03c3bf35-9a0b-4a50-a232-dfd1cd8af7af', '89018def-f57b-42ac-b2d1-2454b52d4e2d', 100, 'paid'),
  ('5e5c62ee-e6b0-455e-9f0e-5e2baad19534', 'c6818f81-3f87-45ef-bf76-1a31f36bfca0', '8ec6d1bd-e255-41a6-806e-7f7fd0332250', 150, 'paid');

INSERT INTO public.newsletter_subscribers (email) VALUES
  ('desmond-okoye@demo.greyin.internal'), ('vivian-marsh@demo.greyin.internal'), ('kwame-asante@demo.greyin.internal'),
  ('ingrid-solberg@demo.greyin.internal'), ('owen-bradley@demo.greyin.internal')
ON CONFLICT (email) DO NOTHING;

-- ------------------------------------------------------------
-- PHASE 7: FlexPro extras
-- ------------------------------------------------------------
INSERT INTO public.flexpro_subscriptions (user_id, plan_id, tier_id, status, current_period_end, activated_at) VALUES
  ('c1287989-485d-4e33-a1ab-184218736d5f', 'b466c90b-23dd-43fb-99aa-618c2be737c1', '26f23991-2250-4b19-8818-6a11d7875cb7', 'active', now() + interval '20 days', now() - interval '10 days'),
  ('c7cb9a4a-34cc-4be6-9f26-6c4ebb0b184c', 'b466c90b-23dd-43fb-99aa-618c2be737c1', '26f23991-2250-4b19-8818-6a11d7875cb7', 'active', now() + interval '25 days', now() - interval '5 days'),
  ('fa700248-dd35-4c20-b674-7d741e9f8620', 'b466c90b-23dd-43fb-99aa-618c2be737c1', '26f23991-2250-4b19-8818-6a11d7875cb7', 'active', now() + interval '15 days', now() - interval '15 days')
ON CONFLICT (user_id) DO NOTHING;

DO $$
DECLARE
  v_cj1 UUID; v_cj2 UUID;
BEGIN
  INSERT INTO public.client_jobs (client_id, title, description, budget_amount, currency, status) VALUES
    ('cf5db932-95a1-4a10-a2ae-00ec0658beb6', 'Rebuild internal analytics dashboard', 'Need an experienced freelancer to rebuild an internal analytics dashboard currently held together with spreadsheets -- Postgres backend already exists.', 180000, 'INR', 'open')
    RETURNING id INTO v_cj1;
  INSERT INTO public.client_jobs (client_id, title, description, budget_amount, currency, status) VALUES
    ('ec37f634-2151-40a0-a62c-96301bc61a54', 'Due-diligence data room audit', 'Short freelance engagement auditing and organizing a due-diligence data room ahead of a Series B raise.', 90000, 'INR', 'in_progress')
    RETURNING id INTO v_cj2;

  INSERT INTO public.client_job_applications (job_id, freelancer_id, cover_note, proposed_price, status) VALUES
    (v_cj1, 'c7cb9a4a-34cc-4be6-9f26-6c4ebb0b184c', 'I''ve built exactly this kind of migration off spreadsheets before -- happy to scope a phased approach so the team isn''t blocked mid-project.', 175000, 'pending'),
    (v_cj2, 'a753f3ed-135f-4174-9d62-fcd00eaf09d1', 'Twenty years in finance including M&A due diligence -- this is squarely in my wheelhouse.', 90000, 'accepted')
  ON CONFLICT (job_id, freelancer_id) DO NOTHING;
END $$;

INSERT INTO public.payout_requests (freelancer_id, amount, bank_account_name, bank_account_number, bank_ifsc, status, requested_at) VALUES
  ('c1287989-485d-4e33-a1ab-184218736d5f', 4000, 'Hannah Kim', '000123456789', 'HDFC0000123', 'paid', now() - interval '7 days'),
  ('c7cb9a4a-34cc-4be6-9f26-6c4ebb0b184c', 12000, 'Miguel Santos', '000987654321', 'ICIC0000456', 'pending', now() - interval '2 days');

-- ------------------------------------------------------------
-- PHASE 8: Newest AI features (119-135)
-- ------------------------------------------------------------

-- Longlist future-role subscriptions for the 9 "member" personas.
INSERT INTO public.future_role_subscriptions (future_role_id, user_id) VALUES
  ('0514f6c0-141f-4adc-bc22-ff9973f18a8f', '8ae84b1b-3ef7-47e6-8c0c-15fcc444916c'),
  ('0514f6c0-141f-4adc-bc22-ff9973f18a8f', '8ec6d1bd-e255-41a6-806e-7f7fd0332250'),
  ('0514f6c0-141f-4adc-bc22-ff9973f18a8f', 'e5f360e8-ffd0-4485-884b-60bdaa6005ce'),
  ('45e31dca-6cef-478a-849c-5efc23cd53f8', '6d6ceb53-eb38-4d89-9fd3-c455f2cf3632'),
  ('45e31dca-6cef-478a-849c-5efc23cd53f8', 'cc51488a-adb7-4f36-b17d-8cc5639a4328'),
  ('45e31dca-6cef-478a-849c-5efc23cd53f8', '694de355-f5db-41dd-ad1d-0df54f4dd9ee'),
  ('27564696-d598-4cc3-9b43-e60fa68d3c85', '89018def-f57b-42ac-b2d1-2454b52d4e2d'),
  ('27564696-d598-4cc3-9b43-e60fa68d3c85', '7b954208-c598-4150-af2c-0cf521271083'),
  ('27564696-d598-4cc3-9b43-e60fa68d3c85', '79ccff14-a4e0-4242-9dc7-14c9873df8f9')
ON CONFLICT (future_role_id, user_id) DO NOTHING;

-- Bias-audit self-ID demographics for the same 9. get_bias_audit_report()'s
-- own "eligible" pool is profiles.future_interests / future_interests_note
-- (087), a DIFFERENT column from future_role_subscriptions above -- an
-- earlier draft of this seed conflated the two and left every eligible
-- person with an EMPTY future_interests, so the report's own eligible
-- pool was always zero regardless of demographics or audit-log volume.
-- Each person's stated interest is deliberately in a DIFFERENT role than
-- the one they're subscribed to above: matchCandidatesForRole() excludes
-- a role's own subscribers from its "other candidates to consider" pool
-- (087/apps/longlist/src/lib/match-candidates.ts), so if the only people
-- with future_interests were also that same role's only subscribers, the
-- real matching call would see an empty roster and surface no one --
-- confirmed live: the very first attempt at this produced zero
-- ai_match_audit_log rows for exactly this reason.
INSERT INTO public.profile_demographics (user_id, gender, age_range, disability_status) VALUES
  ('8ae84b1b-3ef7-47e6-8c0c-15fcc444916c', 'woman', '35_44', 'no'),
  ('8ec6d1bd-e255-41a6-806e-7f7fd0332250', 'man', '25_34', 'no'),
  ('e5f360e8-ffd0-4485-884b-60bdaa6005ce', 'man', '45_54', 'prefer_not_to_say'),
  ('6d6ceb53-eb38-4d89-9fd3-c455f2cf3632', 'woman', '25_34', 'no'),
  ('cc51488a-adb7-4f36-b17d-8cc5639a4328', 'man', '35_44', 'yes'),
  ('694de355-f5db-41dd-ad1d-0df54f4dd9ee', 'woman', '35_44', 'no'),
  ('89018def-f57b-42ac-b2d1-2454b52d4e2d', 'man', '55_64', 'no'),
  ('7b954208-c598-4150-af2c-0cf521271083', 'non_binary', '25_34', 'prefer_not_to_say'),
  ('79ccff14-a4e0-4242-9dc7-14c9873df8f9', 'woman', '45_54', 'no')
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.profiles SET future_interests = ARRAY['Director of Data Science'] WHERE id = '8ae84b1b-3ef7-47e6-8c0c-15fcc444916c';
UPDATE public.profiles SET future_interests = ARRAY['Head of International Expansion'] WHERE id = '8ec6d1bd-e255-41a6-806e-7f7fd0332250';
UPDATE public.profiles SET future_interests = ARRAY['Director of Data Science','Head of International Expansion'] WHERE id = 'e5f360e8-ffd0-4485-884b-60bdaa6005ce';
UPDATE public.profiles SET future_interests = ARRAY['VP of Engineering'] WHERE id = '6d6ceb53-eb38-4d89-9fd3-c455f2cf3632';
UPDATE public.profiles SET future_interests = ARRAY['Head of International Expansion'] WHERE id = 'cc51488a-adb7-4f36-b17d-8cc5639a4328';
UPDATE public.profiles SET future_interests = ARRAY['VP of Engineering','Head of International Expansion'] WHERE id = '694de355-f5db-41dd-ad1d-0df54f4dd9ee';
UPDATE public.profiles SET future_interests = ARRAY['VP of Engineering'] WHERE id = '89018def-f57b-42ac-b2d1-2454b52d4e2d';
UPDATE public.profiles SET future_interests = ARRAY['Director of Data Science'] WHERE id = '7b954208-c598-4150-af2c-0cf521271083';
UPDATE public.profiles SET future_interests = ARRAY['VP of Engineering','Director of Data Science'] WHERE id = '79ccff14-a4e0-4242-9dc7-14c9873df8f9';

-- ai_match_audit_log is intentionally NOT hand-inserted here -- it's an
-- append-only record of when the real matchCandidatesForRole() LLM call
-- actually surfaced someone, and its own credibility as an audit trail
-- depends on that being true. Populate it for real instead, once the
-- rows above exist, by visiting (as each future_role's own posting
-- employer) /employer/roles/<role-id>/candidates for each of:
--   0514f6c0-141f-4adc-bc22-ff9973f18a8f (Priya Raghavan, VP of Engineering)
--   45e31dca-6cef-478a-849c-5efc23cd53f8 (Marcus Webb, Director of Data Science)
--   27564696-d598-4cc3-9b43-e60fa68d3c85 (Elena Petrova, Head of Int'l Expansion)
-- -- that one real page load per role IS the seed step for this table.

-- Job recommendation feedback loop (125) -- real feedback on a job the
-- candidate saw recommended but didn't apply to.
INSERT INTO public.job_recommendation_feedback (user_id, job_id, recommendation_type, feedback, note) VALUES
  ('4c0b35b9-b969-44c7-abdc-aa09dc34e4ef', '44d8b44d-c62b-44b2-a607-3c9a83dee3b7', 'profile', 'not_relevant', 'Data engineering isn''t adjacent to my mobile background -- not sure why this surfaced.'),
  ('6ffb6dc3-e082-4c69-835c-c866f6de5ef5', '93473270-3855-44d3-ad5a-5eb5b83013dc', 'top_candidate', 'wrong_fit', 'Finance leadership is well outside my backend engineering track record.')
ON CONFLICT (user_id, job_id) DO NOTHING;

-- Shareable Verified Score badge (133) -- enable one real badge so
-- /verify/[slug] has something to actually render.
INSERT INTO public.public_score_badges (user_id, slug, enabled) VALUES
  ('c1287989-485d-4e33-a1ab-184218736d5f', encode(gen_random_bytes(6), 'hex'), true)
ON CONFLICT (user_id) DO UPDATE SET enabled = true;

-- Proactive matchmaking (134/135) -- one real candidate-side and one
-- real employer-side match, seeded directly (the sweep functions
-- require a live auth.uid() session this script has none of) using a
-- genuine, currently-unapplied >=50%-skills-overlap match on each side --
-- an earlier draft of the employer-side row (Hannah Kim vs a job
-- requiring Engineering Leadership/Org Design/Hiring) was only a 33%
-- overlap and would not have reproduced from the real sweep function;
-- Benjamin Cross vs Marcus Webb's own VP of Finance posting below is a
-- real 67% overlap, confirmed against the exact threshold in 135.
INSERT INTO public.proactive_match_notifications (job_id, candidate_user_id, side) VALUES
  ('e6c68e95-2239-48ad-87fa-31abf609db7d', 'fa700248-dd35-4c20-b674-7d741e9f8620', 'candidate'),
  ('52c305b2-593c-45c9-852c-38efc8b00a28', 'a753f3ed-135f-4174-9d62-fcd00eaf09d1', 'employer')
ON CONFLICT (job_id, candidate_user_id, side) DO NOTHING;

INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
  ('fa700248-dd35-4c20-b674-7d741e9f8620', 'proactive_job_match', 'A new job matches your profile', 'Senior Product Manager', '/jobs/e6c68e95-2239-48ad-87fa-31abf609db7d'),
  ('ec37f634-2151-40a0-a62c-96301bc61a54', 'proactive_candidate_match', 'New candidates match your job posting', '1 candidate matching "VP of Finance" hasn''t applied yet', '/employer/jobs/52c305b2-593c-45c9-852c-38efc8b00a28');

COMMIT;

-- ------------------------------------------------------------
-- POST-STEPS (not SQL -- run these after the script above)
-- ------------------------------------------------------------
-- 1. refresh_platform_score_means() (via REST RPC or a real /dashboard
--    visit) so Greyin Score coverage reflects the new evidence immediately
--    rather than waiting on its own 30-min timer.
-- 2. Drive the 3 real Longlist matching page-loads noted in PHASE 8
--    above, as each role's own posting employer, to populate
--    ai_match_audit_log for real.
-- 3. Regenerate the market-intelligence report (greyin-hub admin ->
--    "Generate now") so it reflects the applications/jobs volume this
--    file just added, not whatever snapshot predates it.
-- 4. If greymatters_post_quality / saltnpepper_reply_quality don't
--    already have a real sweep_interval_minutes set, the new posts/
--    replies above will only get AI-scored the next time someone visits
--    the relevant /dashboard -- set an interval (llm_feature_flags) or
--    visit those pages directly to score them immediately.
