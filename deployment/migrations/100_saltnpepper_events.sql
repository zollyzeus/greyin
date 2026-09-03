-- ============================================================
-- Gap-audit item #7 (code-level pass, 2026-08-31): Community Events &
-- Resources / RSVP. Emergent has a fully real events+RSVP feature
-- (GET/POST /events, POST /events/{id}/rsvp); Greyin had zero
-- equivalent. Net-new, self-contained -- discussions.category is
-- unconstrained free text with nothing to repurpose, so this is real
-- new schema, not a reuse of something half-built. Houses in
-- Salt & Pepper (the community pillar), per user decision 2026-09-02.
-- ============================================================

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  is_virtual BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  capacity INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_starts_at ON public.events(starts_at);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view events"
  ON public.events FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Members can host events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their own events"
  ON public.events FOR DELETE
  USING (auth.uid() = host_id);

CREATE POLICY "Admins can delete any event"
  ON public.events FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Composite PK, no surrogate id -- exact shape as project_upvotes
-- (009_saltnpepper_community.sql).
CREATE TABLE public.event_rsvps (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view RSVPs"
  ON public.event_rsvps FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Members can RSVP"
  ON public.event_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can cancel their own RSVP"
  ON public.event_rsvps FOR DELETE
  USING (auth.uid() = user_id);

-- Same SECURITY DEFINER notify-on-insert shape as notify_new_application()
-- (017_notifications.sql).
CREATE OR REPLACE FUNCTION public.notify_new_rsvp()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_host_id UUID;
  v_event_title TEXT;
  v_rsvp_name TEXT;
BEGIN
  SELECT host_id, title INTO v_host_id, v_event_title FROM events WHERE id = NEW.event_id;
  SELECT full_name INTO v_rsvp_name FROM profiles WHERE id = NEW.user_id;

  IF v_host_id IS NOT NULL AND v_host_id <> NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      v_host_id,
      'event_rsvp',
      'New RSVP for your event',
      COALESCE(v_rsvp_name, 'Someone') || ' is going to "' || v_event_title || '"',
      '/events/' || NEW.event_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_event_rsvp_created
  AFTER INSERT ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_rsvp();

NOTIFY pgrst, 'reload schema';
