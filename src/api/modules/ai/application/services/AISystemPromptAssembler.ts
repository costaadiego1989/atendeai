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

export interface AssemblePromptInput {
  tenantId: string;
  conversationId: string;
  branchId?: string | null;
  userMessage: string;
  moduleId: string;
  contextHints?: string[];
  isFirstInteraction: boolean;
  tenant: Tenant;
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

    let prompt = await this.applyMessagingAgentRule(
      input.tenantId,
      systemPrompt,
      input.moduleId,
      input.branchId,
    );

    if (input.contextHints?.length) {
      prompt =
        prompt +
        '\n\n[OPÇÕES PRÉ-DEFINIDAS DO WIDGET — use como contexto de intenção do visitante]:\n' +
        input.contextHints.map((h) => `- ${h}`).join('\n');
    }

    prompt = await this.appendManualAutomationsContext(input.tenantId, prompt);
    prompt = this.aiSafetyGate.appendPlatformLimits(prompt);

    return { prompt, diagnostics };
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
