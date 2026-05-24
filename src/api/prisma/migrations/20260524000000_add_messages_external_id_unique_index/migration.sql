-- Partial unique index to prevent duplicate inbound messages per conversation.
-- Allows NULL external_id (outbound messages created before provider ID is known).
CREATE UNIQUE INDEX idx_messages_dedup
  ON messaging_schema.messages (conversation_id, external_id)
  WHERE external_id IS NOT NULL;
