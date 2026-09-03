-- ============================================================
-- Order Messaging System
-- ============================================================
--
-- Adds order messaging/chat functionality to enable
-- communication between buyers and sellers
--
-- Run this after 004_order_tracking_enhancements.sql
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create order_messages table
CREATE TABLE IF NOT EXISTS public.order_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.gig_orders ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE public.order_messages IS 'Messages exchanged between buyer and seller for an order';
COMMENT ON COLUMN public.order_messages.order_id IS 'Reference to the order';
COMMENT ON COLUMN public.order_messages.sender_id IS 'User who sent the message';
COMMENT ON COLUMN public.order_messages.message IS 'Message content';
COMMENT ON COLUMN public.order_messages.attachments IS 'JSONB array of file attachments';
COMMENT ON COLUMN public.order_messages.read_at IS 'Timestamp when message was read by recipient';

-- Enable RLS
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_messages
-- Users can view messages for orders they're part of
CREATE POLICY "Users can view messages for their orders"
  ON public.order_messages FOR SELECT
  USING (
    auth.uid() IN (
      SELECT UNNEST(ARRAY[buyer_id, seller_id]) 
      FROM public.gig_orders 
      WHERE id = order_id
    )
  );

-- Users can send messages for orders they're part of
CREATE POLICY "Users can send messages for their orders"
  ON public.order_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND auth.uid() IN (
      SELECT UNNEST(ARRAY[buyer_id, seller_id]) 
      FROM public.gig_orders 
      WHERE id = order_id
    )
  );

-- Users can update their own messages (for read receipts)
CREATE POLICY "Users can update messages for their orders"
  ON public.order_messages FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT UNNEST(ARRAY[buyer_id, seller_id]) 
      FROM public.gig_orders 
      WHERE id = order_id
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON public.order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_sender_id ON public.order_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_created_at ON public.order_messages(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER order_messages_updated_at
  BEFORE UPDATE ON public.order_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to get unread message count for an order
CREATE OR REPLACE FUNCTION get_unread_message_count(p_order_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.order_messages
    WHERE order_id = p_order_id
      AND sender_id != p_user_id
      AND read_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add message_count and last_message columns to gig_orders for quick access
ALTER TABLE public.gig_orders 
  ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

COMMENT ON COLUMN public.gig_orders.message_count IS 'Total number of messages in the order conversation';
COMMENT ON COLUMN public.gig_orders.last_message_at IS 'Timestamp of the last message';

-- Function to update order message stats
CREATE OR REPLACE FUNCTION update_order_message_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.gig_orders
  SET 
    message_count = (
      SELECT COUNT(*) FROM public.order_messages WHERE order_id = NEW.order_id
    ),
    last_message_at = NEW.created_at
  WHERE id = NEW.order_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update order stats when message is sent
CREATE TRIGGER update_order_message_stats_trigger
  AFTER INSERT ON public.order_messages
  FOR EACH ROW EXECUTE FUNCTION update_order_message_stats();
