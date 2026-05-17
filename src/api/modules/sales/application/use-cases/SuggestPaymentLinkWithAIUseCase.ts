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

    const response = await this.aiEngine.generateResponse({
      systemPrompt: basePrompt.join(' '),
      contextHistory: [],
      userMessage: [
        `Empresa: ${tenant?.companyName.value ?? 'Tenant sem nome'}.`,
        `Pedido do usuario: ${input.prompt}`,
      ].join('\n'),
      maxTokens: 300,
      temperature: 0.2,
    });

    const parsed = this.parseJsonPayload(response.text);

    const name = String(parsed?.name ?? '').trim();
    const rawValue = Number(parsed?.value ?? 0);

    if (!name || !Number.isFinite(rawValue) || rawValue <= 0) {
      throw new InternalServerErrorException(
        'AI could not generate a valid payment link suggestion',
      );
    }

    const billingType = this.normalizeBillingType(parsed?.billingType);
    const expiresAt = this.normalizeDate(parsed?.expiresAt);

    return {
      name,
      description: this.toOptionalString(parsed?.description),
      label: this.toOptionalString(parsed?.label),
      value: rawValue,
      billingType,
      expiresAt,
      source: 'AI' as const,
    };
  }

  private parseJsonPayload(raw: string): Record<string, unknown> {
    const trimmed = raw.trim();

    try {
      return JSON.parse(trimmed);
    } catch {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new InternalServerErrorException(
          'AI could not generate a valid payment link suggestion',
        );
      }

      try {
        return JSON.parse(match[0]);
      } catch {
        throw new InternalServerErrorException(
          'AI could not generate a valid payment link suggestion',
        );
      }
    }
  }

  private normalizeBillingType(
    value: unknown,
  ): 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED' {
    const normalized = String(value ?? 'PIX')
      .trim()
      .toUpperCase();
    if (
      normalized === 'PIX' ||
      normalized === 'CREDIT_CARD' ||
      normalized === 'BOLETO' ||
      normalized === 'UNDEFINED'
    ) {
      return normalized;
    }

    return 'PIX';
  }

  private normalizeDate(value: unknown): string | undefined {
    if (!value || value === 'null') {
      return undefined;
    }

    const normalized = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : undefined;
  }

  private toOptionalString(value: unknown): string | undefined {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : undefined;
  }
}
