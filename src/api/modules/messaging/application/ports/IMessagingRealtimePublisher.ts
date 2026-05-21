export interface MessagingRealtimeEvent {
  type:
    | 'connection.ready'
    | 'message.received'
    | 'message.queued'
    | 'message.sent'
    | 'message.failed'
    | 'conversation.status.changed'
    | 'conversation.created';
  tenantId: string;
  conversationId?: string;
  messageId?: string;
  contactId?: string;
  channel?: string;
  status?: string;
  at: string;
}

export interface IMessagingRealtimePublisher {
  publish(event: MessagingRealtimeEvent): Promise<void>;
}

export const MESSAGING_REALTIME_PUBLISHER = Symbol(
  'MESSAGING_REALTIME_PUBLISHER',
);
