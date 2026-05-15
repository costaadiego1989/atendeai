import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/use-toast';
import { companySettingsService } from '@/modules/settings/services/company-settings-service';
import { useCompanySettingsQuery } from '@/modules/settings/view-models/useCompanySettingsQuery';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';

const guardrailSchema = z.object({
  enabled: z.boolean(),
  rule: z.string().trim().min(8, 'Explique o guardrail com mais detalhes'),
});

const aiSettingsSchema = z.object({
  tone: z.enum(['FRIENDLY', 'PROFESSIONAL', 'CASUAL']),
  systemPrompt: z.string().trim().min(10, 'O prompt base precisa ter pelo menos 10 caracteres'),
  escalationMessage: z.string().trim().optional(),
  language: z.string().trim().min(2),
  maxTokensPerResponse: z.coerce.number().min(50).max(4000),
  confidenceThreshold: z.coerce.number().min(0).max(1),
  firstInteraction: guardrailSchema,
  scheduleAndInventory: guardrailSchema,
  recovery: guardrailSchema,
});

export type AISettingsForm = z.infer<typeof aiSettingsSchema>;

const DEFAULT_RULES = {
  firstInteraction:
    'Na primeira interação, pedir contexto antes de listar todos os dados da empresa.',
  scheduleAndInventory:
    'Consultar agenda, estoque e disponibilidade real antes de prometer horário, vaga ou produto.',
  recovery:
    'Em recovery, manter tom claro, respeitoso e contextualizado com a cobrança.',
} as const;

function buildFormValues(aiConfig?: {
  basePrompt?: string;
  tone?: 'friendly' | 'professional' | 'casual' | 'formal';
  language?: string;
  handoffConfidence?: number;
  escalationMessage?: string;
  businessRules?: string[];
  maxTokensPerResponse?: number;
}): AISettingsForm {
  const rules = aiConfig?.businessRules ?? [];

  const firstInteractionRule =
    rules.find((rule) => rule.includes('primeira interação')) ??
    DEFAULT_RULES.firstInteraction;
  const scheduleRule =
    rules.find(
      (rule) =>
        rule.includes('agenda') ||
        rule.includes('estoque') ||
        rule.includes('disponibilidade'),
    ) ?? DEFAULT_RULES.scheduleAndInventory;
  const recoveryRule =
    rules.find((rule) => rule.includes('recovery') || rule.includes('cobrança')) ??
    DEFAULT_RULES.recovery;

  return {
    tone:
      aiConfig?.tone === 'casual'
        ? 'CASUAL'
        : aiConfig?.tone === 'professional'
          ? 'PROFESSIONAL'
          : 'FRIENDLY',
    systemPrompt:
      aiConfig?.basePrompt ??
      'Voce e uma assistente comercial consultiva, objetiva e gentil, focada em descobrir a necessidade do cliente e conduzir a conversa para o proximo passo.',
    escalationMessage:
      aiConfig?.escalationMessage ??
      'Vou chamar um especialista humano para seguir com voce na proxima etapa.',
    language: aiConfig?.language ?? 'pt-BR',
    maxTokensPerResponse: aiConfig?.maxTokensPerResponse ?? 500,
    confidenceThreshold: aiConfig?.handoffConfidence ?? 0.7,
    firstInteraction: {
      enabled: rules.some((rule) => rule === firstInteractionRule),
      rule: firstInteractionRule,
    },
    scheduleAndInventory: {
      enabled: rules.some((rule) => rule === scheduleRule),
      rule: scheduleRule,
    },
    recovery: {
      enabled: rules.some((rule) => rule === recoveryRule),
      rule: recoveryRule,
    },
  };
}

function mapToneForStore(
  tone: 'FRIENDLY' | 'PROFESSIONAL' | 'CASUAL',
): 'friendly' | 'professional' | 'casual' {
  if (tone === 'PROFESSIONAL') return 'professional';
  if (tone === 'CASUAL') return 'casual';
  return 'friendly';
}

export function useAISettingsViewModel() {
  const queryClient = useQueryClient();
  const { tenant, updateTenant } = useAuthStore();
  const tenantId = tenant?.id;
  const tenantQuery = useCompanySettingsQuery(tenantId);

  const form = useForm<AISettingsForm>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: buildFormValues(),
  });

  useEffect(() => {
    if (tenantQuery.data?.aiConfig) {
      form.reset(buildFormValues(tenantQuery.data.aiConfig));
    }
  }, [form, tenantQuery.data?.aiConfig]);

  const saveMutation = useMutation({
    mutationFn: (input: AISettingsForm) => {
      const businessRules = [
        input.firstInteraction.enabled ? input.firstInteraction.rule.trim() : null,
        input.scheduleAndInventory.enabled
          ? input.scheduleAndInventory.rule.trim()
          : null,
        input.recovery.enabled ? input.recovery.rule.trim() : null,
      ].filter((rule): rule is string => Boolean(rule));

      return companySettingsService.updateAIConfig(tenantId as string, {
        systemPrompt: input.systemPrompt.trim(),
        tone: input.tone,
        language: input.language.trim(),
        maxTokensPerResponse: input.maxTokensPerResponse,
        confidenceThreshold: input.confidenceThreshold,
        escalationMessage: input.escalationMessage?.trim() || null,
        businessRules,
      });
    },
    onSuccess: (_response, variables) => {
      updateTenant({
        aiConfig: {
          basePrompt: variables.systemPrompt,
          tone: mapToneForStore(variables.tone),
          language: variables.language,
          handoffConfidence: variables.confidenceThreshold,
          escalationMessage: variables.escalationMessage,
          businessRules: [
            variables.firstInteraction.enabled
              ? variables.firstInteraction.rule.trim()
              : null,
            variables.scheduleAndInventory.enabled
              ? variables.scheduleAndInventory.rule.trim()
              : null,
            variables.recovery.enabled ? variables.recovery.rule.trim() : null,
          ].filter((rule): rule is string => Boolean(rule)),
          maxTokensPerResponse: variables.maxTokensPerResponse,
          updatedAt: new Date().toISOString(),
        },
      });

      void queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] });

      toast({
        title: 'Guardrails salvos',
        description: 'A configuração da IA comercial foi atualizada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao salvar IA',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível salvar os guardrails agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  return {
    form,
    tenantId,
    isLoading: !tenantId || (tenantQuery.isLoading && !tenantQuery.data),
    isSaving: saveMutation.isPending,
    submit: form.handleSubmit((values) => saveMutation.mutate(values)),
  };
}
