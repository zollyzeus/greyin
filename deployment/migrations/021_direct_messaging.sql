-- ============================================================
-- Direct messaging (shared across all 4 apps)
-- ============================================================
--
-- Single shared table set (same reasoning as notifications — one Supabase
-- project backs all 4 apps). Two-participant conversations only for now;
-- entry points are Salt & Pepper's members directory and Greyin's
-- candidate/application views, per the benchmark's priority order.
--
-- Conversation creation goes through a SECURITY DEFINER RPC rather than
-- direct client INSERTs — a plain "authenticated users can insert
-- participants" policy would let any user add arbitrary other users to
-- arbitrary conversations, since at insert-time (before any participant row
-- exists) there's nothing for RLS to check membership against yet.
-- ============================================================

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX idx_direct_messages_conversation ON public.direct_messages(conversation_id, created_at);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their conversations"
  ON public.conversations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.user_id = auth.uid()
  ));

CREATE POLICY "Participants can view conversation membership"
  ON public.conversation_participants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants me
    WHERE me.conversation_id = conversation_participants.conversation_id
      AND me.user_id = auth.uid()
  ));

CREATE POLICY "Participants can view messages in their conversations"
  ON public.direct_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_participants.conversation_id = direct_messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
  ));

CREATE POLICY "Participants can send messages in their conversations"
  ON public.direct_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_participants.conversation_id = direct_messages.conversation_id
        AND conversation_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Recipients can mark messages read"
  ON public.direct_messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_participants.conversation_id = direct_messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
  ));

-- Finds an existing 2-person conversation between the caller and
-- other_user_id, or creates one. SECURITY DEFINER so it can insert both
-- participant rows atomically; the WHERE auth.uid() IS NOT NULL guard
-- keeps it from being usable by an unauthenticated request even though the
-- function itself runs with elevated privilege.
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id UUID)
RETURNS UUID
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF auth.uid() = other_user_id THEN
    RAISE EXCEPTION 'Cannot start a conversation with yourself';
  END IF;

  SELECT cp1.conversation_id INTO v_conversation_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = auth.uid() AND cp2.user_id = other_user_id
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO conversations DEFAULT VALUES RETURNING id INTO v_conversation_id;
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES (v_conversation_id, auth.uid());
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES (v_conversation_id, other_user_id);

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(UUID) TO authenticated;

-- Notify the other participant(s) the same way every other feature this
-- session feeds the shared notifications table.
CREATE OR REPLACE FUNCTION public.notify_new_direct_message()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sender_name TEXT;
  v_recipient RECORD;
BEGIN
  SELECT full_name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;

  FOR v_recipient IN
    SELECT user_id FROM conversation_participants
    WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_recipient.user_id, 'direct_message', 'New message from ' || COALESCE(v_sender_name, 'a member'),
            LEFT(NEW.body, 140), '/messages/' || NEW.conversation_id);
  END LOOP;

  UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_direct_message_created
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_direct_message();

NOTIFY pgrst, 'reload schema';
