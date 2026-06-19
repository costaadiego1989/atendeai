/**
 * Supported automation trigger types.
 * Each trigger fires when a specific domain event occurs.
 */
export enum TriggerType {
  /** New contact created */
  CONTACT_CREATED = 'contact_created',
  /** Contact tag added */
  TAG_ADDED = 'tag_added',
  /** Message received from contact */
  MESSAGE_RECEIVED = 'message_received',
  /** Payment overdue by N days */
  PAYMENT_OVERDUE = 'payment_overdue',
  /** Appointment confirmed */
  APPOINTMENT_CONFIRMED = 'appointment_confirmed',
  /** Appointment reminder (N minutes before) */
  APPOINTMENT_REMINDER = 'appointment_reminder',
  /** Order placed */
  ORDER_PLACED = 'order_placed',
  /** Cart abandoned */
  CART_ABANDONED = 'cart_abandoned',
  /** Custom webhook received */
  WEBHOOK_RECEIVED = 'webhook_received',
  /** Scheduled (cron-based) */
  SCHEDULED = 'scheduled',
  /**
   * Manual trigger — automation is not fired by a domain event.
   * It can be dispatched explicitly by a human agent from the chat UI,
   * or by the AI when it detects a matching use case.
   */
  MANUAL = 'manual',
}

export interface TriggerConfig {
  type: TriggerType;
  /** Type-specific configuration */
  config: Record<string, unknown>;
}
