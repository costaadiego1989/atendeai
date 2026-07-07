import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AIContextAggregator } from './AIContextAggregator';
import { AiSafetyGate } from './AiSafetyGate';
import { TenantAgentRuleService } from '@modules/agent-rules/application/services/TenantAgentRuleService';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import {
  MANUAL_AUTOMATION_FACADE,
  IManualAutomationFacade,
  ManualAutomationSummary,
} from '../ports/IManualAutomationFacade';

const PHASE_INSTRUCTIONS: Record<string, string> = {
  GREETING:
    'Cumprimente o cliente de forma amigável. Identifique a necessidade principal.',
  QUALIFICATION:
    'Faça perguntas para entender melhor o que o cliente precisa. Identifique o produto/serviço adequado.',
  PRODUCT_DISCOVERY:
    'Apresente opções relevantes. Destaque benefícios e diferenciais.',
  QUOTE: 'Informe valores, condições de pagamento e prazos. Seja transparente.',
  CHECKOUT: 'Guie o cliente para finalizar a compra. Confirme itens e valores.',
  CONFIRMATION: 'Confirme o pedido/agendamento. Informe próximos passos.',
  SUPPORT: 'Resolva dúvidas ou problemas. Seja empático e objetivo.',
  COMPLAINT:
    'Escute com atenção. Peça desculpas se cabível. Ofereça solução concreta.',
  SCHEDULING:
    'Auxilie com data, horário e profissional. Confirme disponibilidade.',
  FOLLOW_UP: 'Verifique satisfação. Ofereça reagendamento se necessário.',
  ORDER_TAKING:
    'Registre itens do pedido. Confirme quantidades e personalizações.',
  CUSTOMIZATION: 'Pergunte sobre personalizações (tamanho, sabor, extras).',
  DELIVERY_TRACKING: 'Informe status da entrega. Forneça previsão atualizada.',
  DEBT_IDENTIFICATION:
    'Identifique o débito com respeito. Apresente valores atualizados.',
  NEGOTIATION:
    'Ofereça condições de pagamento. Busque acordo viável para ambas as partes.',
  PROMISE_TO_PAY: 'Confirme o acordo. Registre data e valor prometido.',
  SERVICE_SELECTION: 'Apresente serviços disponíveis. Ajude a escolher.',
  PROFESSIONAL_SELECTION:
    'Apresente profissionais disponíveis com especialidades.',
  CASE_ASSESSMENT:
    'Colete informações sobre o caso. Identifique área do direito.',
  PROPOSAL: 'Apresente proposta de honorários e escopo do trabalho.',
  ONBOARDING: 'Oriente sobre documentos necessários e próximos passos.',
};

export interface AssemblePromptInput {
  tenantId: string;
  conversationId: string;
  branchId?: string | null;
  userMessage: string;
  moduleId: string;
  contextHints?: string[];
  isFirstInteraction: boolean;
  tenant: Tenant;
  currentPhase?: string;
  businessType?: string;
  agentPromptTemplate?: string;
}

export interface AssemblePromptResult {
  prompt: string;
  diagnostics: Record<string, unknown>;
}

@Injectable()
export class AISystemPromptAssembler {
  private readonly logger = new Logger(AISystemPromptAssembler.name);

  constructor(
    private readonly contextAggregator: AIContextAggregator,
    private readonly tenantAgentRuleService: TenantAgentRuleService,
    private readonly aiSafetyGate: AiSafetyGate,
    @Optional()
    @Inject(MANUAL_AUTOMATION_FACADE)
    private readonly manualAutomationFacade?: IManualAutomationFacade,
  ) {}

  async assemble(input: AssemblePromptInput): Promise<AssemblePromptResult> {
    const { systemPrompt, diagnostics } =
      await this.contextAggregator.aggregate(
        input.tenant,
        input.conversationId,
        input.userMessage,
        input.isFirstInteraction,
      );

    let basePrompt = systemPrompt;

    // T12: If agent provides a prompt template, resolve placeholders and prepend
    if (input.agentPromptTemplate) {
      const phaseInstructions =
        PHASE_INSTRUCTIONS[input.currentPhase ?? ''] ?? '';
      const resolved = input.agentPromptTemplate
        .replace(
          /\{\{tenantName\}\}/g,
          input.tenant.companyName?.value ?? input.tenantId,
        )
        .replace(/\{\{currentPhase\}\}/g, input.currentPhase ?? 'GREETING')
        .replace(/\{\{phaseInstructions\}\}/g, phaseInstructions);
      basePrompt = resolved + '\n\n' + systemPrompt;
    }

    let prompt = await this.applyMessagingAgentRule(
      input.tenantId,
      basePrompt,
      input.moduleId,
      input.branchId,
    );

    if (input.contextHints?.length) {
      prompt =
        prompt +
        '\n\n[OPÇÕES PRÉ-DEFINIDAS DO WIDGET — use como contexto de intenção do visitante]:\n' +
        input.contextHints.map((h) => `- ${h}`).join('\n');
    }

    prompt = this.appendPhaseContext(
      prompt,
      input.currentPhase,
      input.businessType,
    );
    prompt = await this.appendManualAutomationsContext(input.tenantId, prompt);
    prompt = this.aiSafetyGate.appendPlatformLimits(prompt);

    return { prompt, diagnostics };
  }

  private appendPhaseContext(
    prompt: string,
    currentPhase?: string,
    businessType?: string,
  ): string {
    if (!currentPhase) return prompt;

    const phaseInstructions = PHASE_INSTRUCTIONS[currentPhase];
    const section = [
      `\n\n[FASE ATUAL DA CONVERSA: ${currentPhase}]`,
      businessType ? `Tipo de negócio: ${businessType}` : '',
      phaseInstructions
        ? `Instruções para esta fase: ${phaseInstructions}`
        : '',
      'Inclua o campo "phase" na resposta com a fase que melhor descreve o próximo estado da conversa.',
    ]
      .filter(Boolean)
      .join('\n');

    return prompt + section;
  }

  private async applyMessagingAgentRule(
    tenantId: string,
    systemPrompt: string,
    moduleId: string,
    branchId?: string | null,
  ): Promise<string> {
    try {
      const agentRule = await this.tenantAgentRuleService.getRule(
        tenantId,
        moduleId,
        'SYSTEM',
        tenantId,
        branchId,
      );

      const customPrompt = agentRule?.isActive
        ? agentRule.customPrompt?.trim()
        : '';
      if (!customPrompt) {
        return systemPrompt;
      }

      const scopeLabel =
        agentRule?.branchId && !agentRule?.inheritedFromTenant
          ? 'DA FILIAL'
          : 'DO TENANT';

      if (agentRule?.fallbackToGlobal === false) {
        return [
          systemPrompt,
          `[ATENCAO: AS DIRETRIZES ${scopeLabel} ABAIXO DEVEM TER PRIORIDADE SOBRE O TOM PADRAO.]`,
          `[DIRETRIZES PERSONALIZADAS DE CONVERSAS]:`,
          customPrompt,
        ].join('\n\n');
      }

      return [
        systemPrompt,
        `[DIRETRIZES PERSONALIZADAS DE CONVERSAS ${scopeLabel}]:`,
        customPrompt,
      ].join('\n\n');
    } catch (e: unknown) {
      this.logger.warn(
        `apply_messaging_agent_rule_failed tenant=${tenantId} module=${moduleId} branch=${branchId ?? 'none'} detail=${e instanceof Error ? e.message : String(e)}`,
      );
      return systemPrompt;
    }
  }

  private async appendManualAutomationsContext(
    tenantId: string,
    prompt: string,
  ): Promise<string> {
    if (!this.manualAutomationFacade) return prompt;

    try {
      const active = await this.manualAutomationFacade.listActive(tenantId);
      if (active.length === 0) return prompt;

      const lines = active.map(
        (a: ManualAutomationSummary) =>
          `- [USE_AUTOMATION:${a.id}] → "${a.name}"${a.description ? ` — ${a.description}` : ''}`,
      );

      return (
        prompt +
        '\n\n[AUTOMAÇÕES DISPONÍVEIS — inclua o marcador entre colchetes quando for o caso de uso correto]:\n' +
        lines.join('\n') +
        '\n(O marcador é removido automaticamente antes de chegar ao contato.)'
      );
    } catch (err: unknown) {
      this.logger.warn(
        `appendManualAutomationsContext: could not load automations — ${String(err)}`,
      );
      return prompt;
    }
  }
}
