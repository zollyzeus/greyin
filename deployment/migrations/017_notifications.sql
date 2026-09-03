-- ============================================================
-- In-app notifications
-- ============================================================
--
-- A single shared table (the Supabase project is shared across all 4 apps)
-- populated by triggers on the events users actually care about: someone
-- applied to your job / your application status changed, an order's status
-- changed, a new order chat message, a new comment on your post, a new
-- reply to your discussion, your withdrawal request was processed. Trigger
-- functions are SECURITY DEFINER (same pattern as handle_new_user /
-- handle_email_confirmed) since they write notifications for a DIFFERENT
-- user than whoever's RLS-scoped action fired the trigger.
-- ============================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark their own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Greyin B2B: applications
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_new_application()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_employer_id UUID;
  v_job_title TEXT;
BEGIN
  SELECT companies.user_id, jobs.title INTO v_employer_id, v_job_title
  FROM jobs JOIN companies ON companies.id = jobs.company_id
  WHERE jobs.id = NEW.job_id;

  IF v_employer_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_employer_id, 'application_new', 'New application received',
            'Someone applied to "' || v_job_title || '"', '/employer/jobs/' || NEW.job_id || '/applications');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_application_created
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_application();

CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_candidate_user_id UUID;
  v_job_title TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT candidates.user_id INTO v_candidate_user_id FROM candidates WHERE candidates.id = NEW.candidate_id;
    SELECT jobs.title INTO v_job_title FROM jobs WHERE jobs.id = NEW.job_id;

    IF v_candidate_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (v_candidate_user_id, 'application_status', 'Application status updated',
              'Your application for "' || v_job_title || '" is now ' || NEW.status, '/dashboard/applications');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_application_status_updated
  AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_status_change();

-- ------------------------------------------------------------
-- FreeAgent: order status + chat messages
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gig_title TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT title INTO v_gig_title FROM gigs WHERE id = NEW.gig_id;

    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (NEW.buyer_id, 'order_status', 'Order status updated',
            '"' || COALESCE(v_gig_title, 'Your order') || '" is now ' || NEW.status, '/orders/' || NEW.id);
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (NEW.seller_id, 'order_status', 'Order status updated',
            '"' || COALESCE(v_gig_title, 'An order') || '" is now ' || NEW.status, '/orders/' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_order_status_updated
  AFTER UPDATE ON public.gig_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

CREATE OR REPLACE FUNCTION public.notify_new_order_message()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_buyer_id UUID;
  v_seller_id UUID;
  v_recipient UUID;
BEGIN
  SELECT buyer_id, seller_id INTO v_buyer_id, v_seller_id FROM gig_orders WHERE id = NEW.order_id;
  v_recipient := CASE WHEN NEW.sender_id = v_buyer_id THEN v_seller_id ELSE v_buyer_id END;

  IF v_recipient IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_recipient, 'order_message', 'New message', LEFT(NEW.message, 140), '/orders/' || NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_order_message_created
  AFTER INSERT ON public.order_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_order_message();

CREATE OR REPLACE FUNCTION public.notify_payout_status_change()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (NEW.freelancer_id, 'payout_status', 'Withdrawal request updated',
            'Your withdrawal request for ₹' || NEW.amount || ' is now ' || NEW.status, '/earnings');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_payout_status_updated
  AFTER UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_payout_status_change();

-- ------------------------------------------------------------
-- GreyMatters: comments
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author_id UUID;
  v_post_title TEXT;
  v_post_slug TEXT;
BEGIN
  SELECT author_id, title, slug INTO v_author_id, v_post_title, v_post_slug FROM posts WHERE id = NEW.post_id;

  IF v_author_id IS NOT NULL AND v_author_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_author_id, 'post_comment', 'New comment on your post',
            'Someone commented on "' || v_post_title || '"', '/posts/' || v_post_slug);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_comment_created
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_comment();

-- ------------------------------------------------------------
-- Salt & Pepper: discussion replies
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_new_discussion_reply()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author_id UUID;
  v_title TEXT;
BEGIN
  SELECT author_id, title INTO v_author_id, v_title FROM discussions WHERE id = NEW.discussion_id;

  IF v_author_id IS NOT NULL AND v_author_id != NEW.author_id THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_author_id, 'discussion_reply', 'New reply to your discussion',
            'Someone replied to "' || v_title || '"', '/discussions/' || NEW.discussion_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_discussion_reply_created
  AFTER INSERT ON public.discussion_replies
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_discussion_reply();

NOTIFY pgrst, 'reload schema';
