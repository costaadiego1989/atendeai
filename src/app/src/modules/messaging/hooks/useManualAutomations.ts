import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { automationService } from '@/modules/automations/services/automation-service';
import { messagingService } from '../services/messaging-service';
import { TriggerType } from '@/modules/automations/types';
import type { Automation } from '@/modules/automations/types';

/**
 * Returns the list of active MANUAL automations for a tenant.
 * These are the automations that human agents can trigger from the chat input
 * and that the AI can also use automatically.
 */
export function useManualAutomations(tenantId: string) {
  return useQuery<Automation[]>({
    queryKey: ['automations', tenantId, 'manual'],
    queryFn: async () => {
      const all = await automationService.list(tenantId, true);
      return all.filter((a) => a.trigger.type === TriggerType.MANUAL);
    },
    staleTime: 60_000,
    enabled: !!tenantId,
  });
}

/**
 * Mutation to dispatch a MANUAL automation in the context of a conversation.
 * Used by human agents — the AI triggers automations via its own pipeline.
 */
export function useTriggerAutomation(tenantId: string, conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (automationId: string) =>
      messagingService.triggerAutomation(tenantId, conversationId, automationId),
    onSuccess: () => {
      // Invalidate messages so the triggered automation's first message appears
      queryClient.invalidateQueries({
        queryKey: ['messages', tenantId, conversationId],
      });
    },
  });
}
