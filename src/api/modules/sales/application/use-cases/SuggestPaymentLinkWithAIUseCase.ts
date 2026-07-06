import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { AI_ENGINE, IAIEngine } from '../../../ai/application/ports/IAIEngine';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../../tenant/domain/repositories/ITenantRepository';
import { TenantAgentRuleService } from '../../../agent-rules/application/services/TenantAgentRuleService';
import { PaymentLinkSuggestionSchema } from '../../domain/schemas/PaymentLinkSuggestionSchema';

export interface SuggestPaymentLinkWithAIInput {
  tenantId: string;
  prompt: string;
  branchId?: string | null;
}

@Injectable()
export class SuggestPaymentLinkWithAIUseCase {
  constructor(
    @Inject(AI_ENGINE)
    private readonly aiEngine: IAIEngine,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly tenantAgentRuleService: TenantAgentRuleService,
  ) {}

  async execute(input: SuggestPaymentLinkWithAIInput) {
    const tenant = await this.tenantRepository.findById(input.tenantId);
    const agentRule = await this.tenantAgentRuleService.getRule(
      input.tenantId,
      'sales',
      'SYSTEM',
      input.tenantId,
      input.branchId,
    );
    const useFallback = agentRule?.fallbackToGlobal !== false;
    const customPrompt = agentRule?.isActive ? agentRule.customPrompt : null;

    const basePrompt = [
      'Você transforma um pedido comercial em um rascunho de link de pagamento.',
      'Responda somente JSON valido.',
      'Formato exato: {"name":"","description":"","label":"","value":0,"billingType":"PIX","expiresAt":null}.',
      'billingType deve ser um de: PIX, CREDIT_CARD, BOLETO, UNDEFINED.',
      'expiresAt deve ser null ou uma data em formato YYYY-MM-DD.',
      'Não inclua markdown, comentários ou texto fora do JSON.',
    ];

    if (!useFallback) {
      // If no fallback, these specific sales instructions are the ONLY rules
      basePrompt.unshift(
        '[ATENção: IGNORE INSTRUCOES GERAIS DA EMPRESA. SIGA APENAS AS REGRAS ABAIXO]',
      );
    }

    if (customPrompt) {
      basePrompt.push(
        '\n[DIRETRIZES PERSONALIZADAS DO AGENTE DE VENDAS]:\n' + customPrompt,
      );
    }

    try {
      const parsed = await this.aiEngine.generateStructuredResponse({
        schema: PaymentLinkSuggestionSchema,
        systemPrompt: basePrompt.join(' '),
        userMessage: [
          `Empresa: ${tenant?.companyName.value ?? 'Tenant sem nome'}.`,
          `Pedido do usuario: ${input.prompt}`,
        ].join('\n'),
        maxTokens: 300,
        temperature: 0.2,
      });

      return {
        name: parsed.name,
        description: parsed.description || undefined,
        label: parsed.label || undefined,
        value: parsed.value,
        billingType: parsed.billingType,
        expiresAt: parsed.expiresAt || undefined,
        source: 'AI' as const,
      };
    } catch {
      throw new InternalServerErrorException(
        'AI could not generate a valid payment link suggestion',
      );
    }
  }
}
