/**
 * Follow-Up Trigger
 *
 * Simula o trigger manual do FollowUpWorker sem esperar o delay real do BullMQ.
 * Publica o evento FollowUpTriggeredEvent diretamente no event bus in-memory.
 */

import { IEventBus } from '@shared/application/ports/IEventBus';
import {
  FollowUpTriggeredEvent,
  FollowUpTriggeredPayload,
} from '@modules/messaging/application/events/FollowUpTriggeredEvent';

export type FollowUpInterval = '1h' | '12h' | '1d' | '7d';

export interface TriggerFollowUpOptions {
  eventBus: IEventBus;
  tenantId: string;
  conversationId: string;
  contactId: string;
  interval: FollowUpInterval;
  intelligence?: {
    summary?: string | null;
    sentiment?: string | null;
    tags?: string[];
    interests?: string[];
    nextStep?: string | null;
    lossReason?: string | null;
  };
}

/**
 * Dispara um follow-up manualmente, simulando o que o FollowUpWorker faria
 * após o delay configurado.
 */
export async function triggerFollowUp(
  options: TriggerFollowUpOptions,
): Promise<void> {
  const payload: FollowUpTriggeredPayload = {
    conversationId: options.conversationId,
    tenantId: options.tenantId,
    contactId: options.contactId,
    interval: options.interval,
    intelligence: options.intelligence,
  };

  const event = new FollowUpTriggeredEvent(payload);
  await options.eventBus.publish(event);
}

/**
 * Dispara follow-ups em sequência com intervalos crescentes.
 * Útil para testar escalação: 1h → 12h → 1d → 7d.
 */
export async function triggerFollowUpEscalation(
  options: Omit<TriggerFollowUpOptions, 'interval'>,
  intervals: FollowUpInterval[] = ['1h', '12h', '1d', '7d'],
): Promise<void> {
  for (const interval of intervals) {
    await triggerFollowUp({ ...options, interval });
  }
}
