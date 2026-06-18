import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { agentRulesService } from '@/modules/agent-rules/services/agent-rules-service';
import type { AgentRuleModuleConfig } from '@/modules/agent-rules/constants/agent-rule-modules';
import {
  AGENT_RULE_NOTES_MAX_LENGTH,
  AGENT_RULE_PROMPT_MAX_LENGTH,
} from '@/modules/agent-rules/constants/agent-rule-modules';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';

export function useModuleAgentRuleViewModel(config: AgentRuleModuleConfig) {
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [fallbackToGlobal, setFallbackToGlobal] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');
  const [notes, setNotes] = useState('');

  const ruleQuery = useQuery({
    queryKey: ['agent-rule', tenant?.id, activeBranchId, config.moduleId],
    enabled: open && Boolean(tenant?.id),
    queryFn: () => agentRulesService.getRule(tenant!.id, config.moduleId, activeBranchId),
  });

  const historyQuery = useQuery({
    queryKey: ['agent-rule-history', tenant?.id, activeBranchId, config.moduleId],
    enabled: open && Boolean(tenant?.id),
    queryFn: () =>
      agentRulesService.listHistory(tenant!.id, config.moduleId, activeBranchId, 25),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (ruleQuery.data) {
      setIsActive(ruleQuery.data.isActive);
      setFallbackToGlobal(ruleQuery.data.fallbackToGlobal ?? true);
      setCustomPrompt(ruleQuery.data.customPrompt ?? '');
      setNotes(ruleQuery.data.notes ?? '');
      return;
    }

    if (!ruleQuery.isLoading) {
      setIsActive(true);
      setFallbackToGlobal(true);
      setCustomPrompt('');
      setNotes('');
    }
  }, [open, ruleQuery.data, ruleQuery.isLoading]);

  const previewMutation = useMutation({
    mutationFn: () =>
      agentRulesService.previewRule(
        tenant!.id,
        config.moduleId,
        {
          customPrompt: customPrompt.trim(),
          isActive,
          fallbackToGlobal,
          notes: notes.trim(),
        },
        activeBranchId,
      ),
    onError: (error) => {
      toast({
        title: 'Pré-visualização indisponível',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Revise o texto da regra e tente novamente.',
        }),
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (!open) {
      previewMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- limpa pré-visualização ao fechar o painel
  }, [open]);

  const canPublish = useMemo(() => {
    const prompt = customPrompt.trim();
    const noteText = notes.trim();

    return (
      prompt.length >= 10 &&
      prompt.length <= AGENT_RULE_PROMPT_MAX_LENGTH &&
      noteText.length <= AGENT_RULE_NOTES_MAX_LENGTH
    );
  }, [customPrompt, notes]);

  const saveMutation = useMutation({
    mutationFn: () =>
      agentRulesService.saveRule(
        tenant!.id,
        config.moduleId,
        {
          customPrompt: customPrompt.trim(),
          isActive,
          fallbackToGlobal,
          notes: notes.trim(),
        },
        activeBranchId,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['agent-rule', tenant?.id, activeBranchId, config.moduleId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['agent-rule-history', tenant?.id, activeBranchId, config.moduleId],
        }),
      ]);
      previewMutation.reset();
      toast({
        title: 'IA personalizada',
        description: `As instruções da IA para ${config.moduleLabel.toLowerCase()} foram salvas com uma nova revisão.`,
      });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Falha ao salvar IA',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível salvar a personalização agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const helperText = useMemo(
    () =>
      isActive
        ? 'Essas instruções complementam ou substituem a IA comercial global neste módulo.'
        : 'Com a regra desligada, este módulo ignora totalmente estas instruções locais.',
    [isActive],
  );

  function applyTrainingExample(prompt: string) {
    setCustomPrompt((current) => {
      const nextPrompt = prompt.trim();
      if (!current.trim()) {
        return nextPrompt;
      }

      if (current.includes(nextPrompt)) {
        return current;
      }

      return `${current.trim()}\n\n${nextPrompt}`;
    });
  }

  return {
    tenantId: tenant?.id ?? null,
    activeBranchId,
    activeBranchName:
      tenant?.branches?.find((branch) => branch.id === activeBranchId)?.name ?? null,
    open,
    setOpen,
    isActive,
    setIsActive,
    fallbackToGlobal,
    setFallbackToGlobal,
    customPrompt,
    setCustomPrompt,
    notes,
    setNotes,
    helperText,
    promptMaxLength: AGENT_RULE_PROMPT_MAX_LENGTH,
    notesMaxLength: AGENT_RULE_NOTES_MAX_LENGTH,
    updatedAt: ruleQuery.data?.updatedAt,
    updatedByUserId: ruleQuery.data?.updatedByUserId,
    updatedByUserName: ruleQuery.data?.updatedByUserName,
    revision: ruleQuery.data?.revision ?? 0,
    scope: ruleQuery.data?.scope ?? (activeBranchId ? 'BRANCH' : 'TENANT'),
    inheritedFromTenant: ruleQuery.data?.inheritedFromTenant ?? false,
    isLoading: ruleQuery.isLoading,
    isError: ruleQuery.isError,
    isSaving: saveMutation.isPending,
    save: () => saveMutation.mutate(),
    applyTrainingExample,
    historyEntries: historyQuery.data ?? [],
    historyLoading: historyQuery.isLoading,
    previewSnapshot: previewMutation.data ?? null,
    isPreviewing: previewMutation.isPending,
    runPreview: () => previewMutation.mutate(),
    canPublish,
    ...config,
  };
}
