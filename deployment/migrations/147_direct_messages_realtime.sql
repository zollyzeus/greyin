-- ============================================================
-- Direct messages: add to the realtime publication
-- ============================================================
--
-- messages/[id]/page.tsx (deepedge + saltnpepper-community) has always
-- been a plain server component -- a new message from the other
-- participant only ever appeared on manual reload. The realtime
-- pattern already exists and works elsewhere in this codebase
-- (NotificationBell.tsx / 102_notifications_realtime.sql); direct_messages
-- (021) already has correct participant-scoped RLS, it was just never
-- added to the publication.
--
-- Run this after 146_discussion_voting.sql
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
