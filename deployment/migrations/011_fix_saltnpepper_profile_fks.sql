-- ============================================================
-- Fix Salt & Pepper FK targets so PostgREST can embed profiles
-- ============================================================
--
-- discussions.author_id, discussion_replies.author_id,
-- builder_projects.user_id, and project_upvotes.user_id were all defined
-- referencing auth.users — but the app queries embed the *profiles* table
-- off those same columns (`profiles:author_id(...)`, `profiles:user_id(...)`),
-- which PostgREST can only resolve via a real foreign key. Since there was
-- no FK from these tables to public.profiles, every one of those queries
-- errored out entirely (not just the embedded field), which is why
-- discussions/projects/members pages were silently empty or crashing.
--
-- profiles.id always exists in lockstep with auth.users.id (the
-- on_auth_user_created trigger inserts a placeholder row at signup, before
-- confirmation), so re-pointing these FKs at profiles is safe and lets the
-- existing embed syntax work as originally intended.
--
-- Run this after 010_confirm_on_verify.sql
-- ============================================================

ALTER TABLE public.discussions
  DROP CONSTRAINT discussions_author_id_fkey,
  ADD CONSTRAINT discussions_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.discussion_replies
  DROP CONSTRAINT discussion_replies_author_id_fkey,
  ADD CONSTRAINT discussion_replies_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.builder_projects
  DROP CONSTRAINT builder_projects_user_id_fkey,
  ADD CONSTRAINT builder_projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.project_upvotes
  DROP CONSTRAINT project_upvotes_user_id_fkey,
  ADD CONSTRAINT project_upvotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Force PostgREST to reload its schema cache so it picks up the new FKs
-- immediately rather than waiting for its next automatic refresh.
NOTIFY pgrst, 'reload schema';
