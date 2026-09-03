-- ============================================================
-- Gap-audit item #2: real-time notification bell. The Realtime
-- subsystem itself was confirmed broken platform-wide (never
-- successfully connected to Postgres, an Erlang-VM DNS resolver quirk
-- -- fixed 2026-09-02 via a static /etc/hosts entry on the realtime
-- service, deployment/supabase-stack.yml) before this migration was
-- written. This is the one schema change Phase 5 needs: add
-- `notifications` to the supabase_realtime publication so
-- postgres_changes subscriptions can actually receive INSERT events.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
