/**
 * Lightweight port used by the AI pipeline to:
 *  1. List MANUAL automations available as message templates.
 *  2. Dispatch a MANUAL automation when the AI decides to use one.
 *
 * The AIModule declares this as an @Optional() dependency.
 * The AutomationModule provides the concrete implementation and re-exports it.
 */
export const MANUAL_AUTOMATION_FACADE = Symbol('IManualAutomationFacade');

export interface ManualAutomationSummary {
  id: string;
  name: string;
  description?: string | null;
}

export interface IManualAutomationFacade {
  /**
   * Returns all active MANUAL automations for a tenant.
   * Used to build the "available templates" section of the AI system prompt.
   */
  listActive(tenantId: string): Promise<ManualAutomationSummary[]>;

  /**
   * Dispatches a MANUAL automation in the context of a conversation.
   * Errors are non-fatal — the caller decides whether to surface them.
   */
  dispatch(
    tenantId: string,
    automationId: string,
    contactId: string,
    conversationId: string,
    triggeredBy: 'AI' | 'HUMAN',
  ): Promise<void>;
}
