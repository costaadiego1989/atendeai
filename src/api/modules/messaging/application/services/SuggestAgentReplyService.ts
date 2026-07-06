import { Inject, Injectable } from '@nestjs/common';
import {
  IConversationIntelligenceRepository,
  CONVERSATION_INTELLIGENCE_REPOSITORY,
} from '../../domain/repositories/IConversationIntelligenceRepository';
import {
  IConversationRepository,
  CONVERSATION_REPOSITORY,
} from '../../domain/repositories/IConversationRepository';
import { IAIEngine, AI_ENGINE } from '../../../ai/application/ports/IAIEngine';
import { TenantAgentRuleService } from '../../../agent-rules/application/services/TenantAgentRuleService';
import { ICheckQuotaUseCase } from '../../../billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import {
  IRecordUsageUseCase,
  UsageType,
} from '../../../billing/application/use-cases/interfaces/IRecordUsageUseCase';
import { toBillableAiTokens } from '../../../billing/domain/constants/AiTokenBillingPolicy';
import {
  IContactRepository,
  CONTACT_REPOSITORY,
} from '@modules/contact/domain/repositories/IContactRepository';

/** Sugestões usam `UsageType.AI_TOKEN` (quota + recordUsage); mudanças aqui afetam faturação — alinhar com `AiTokenBillingPolicy`. */
@Injectable()
export class SuggestAgentReplyService {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    @Inject(CONVERSATION_INTELLIGENCE_REPOSITORY)
    private readonly intelligenceRepository: IConversationIntelligenceRepository,
    @Inject(AI_ENGINE)
    private readonly aiEngine: IAIEngine,
    private readonly tenantAgentRuleService: TenantAgentRuleService,
    @Inject(ICheckQuotaUseCase)
    private readonly checkQuotaUseCase: ICheckQuotaUseCase,
    @Inject(IRecordUsageUseCase)
    private readonly recordUsageUseCase: IRecordUsageUseCase,
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
  ) {}

  async generateSuggestion(
    tenantId: string,
    conversationId: string,
    contactId: string,
  ): Promise<{ text: string }> {
    const quotaCheck = await this.checkQuotaUseCase.execute({
      tenantId,
      type: UsageType.AI_TOKEN,
    });
    if (!quotaCheck.canProceed) {
      if (quotaCheck.status === 'NO_SUBSCRIPTION') {
        return {
          text: 'Sua conta está sendo configurada. Aguarde alguns instantes e tente novamente.',
        };
      }
      if (quotaCheck.status !== 'ACTIVE') {
        return {
          text: 'Sua assinatura está inativa. Verifique seu plano para continuar usando a IA.',
        };
      }
      return {
        text: 'Limite de uso da IA atingido. Renove seu plano para gerar sugestões.',
      };
    }

    const intelligenceMap =
      await this.intelligenceRepository.findByConversationIds(tenantId, [
        conversationId,
      ]);
    const intelligence = intelligenceMap[conversationId];
    const summary =
      intelligence?.summary || 'Nenhum contexto prévio detectado.';

    const messagesPage =
      await this.conversationRepository.findMessagesByConversation(
        tenantId,
        conversationId,
        1,
        3,
      );

    const formattedMessages = messagesPage.data
      .reverse()
      .map((m) => {
        const role = m.sentBy === 'CONTACT' ? 'Cliente' : 'Atendente/IA';
        const msgType =
          m.content.type === 'TEXT'
            ? m.content.text
            : `[Mídia: ${m.content.type}]`;
        return `${role}: ${msgType}`;
      })
      .join('\n');

    const branchId = await this.resolveBranchId(tenantId, contactId);

    const agentRule = await this.tenantAgentRuleService.getRule(
      tenantId,
      'messaging',
      'SYSTEM',
      tenantId,
      branchId,
    );

    const customPrompt = agentRule?.isActive
      ? agentRule.customPrompt?.trim()
      : '';
    let basePrompt = [
      'Você é um assistente ajudando um atendente humano a responder um chat.',
      'Você deve criar APENAS O RASCUNHO que o atendente vai enviar. Seja direto, não inclua aspas, nem "Aqui está a resposta".',
      'O rascunho deve ter NO MÁXIMO 2 frases, amigável e direto ao ponto.',
    ];

    if (customPrompt) {
      if (agentRule?.fallbackToGlobal === false) {
        basePrompt = ['[IGONORE REGRAS DE OUTROS AGENTES]', ...basePrompt];
      }
      basePrompt.push(
        `\n[DIRETRIZES DE TOM DE VOZ E ATENDIMENTO]:\n${customPrompt}`,
      );
    }

    const userMessage = [
      `[RESUMO DA CONVERSA]`,
      `${summary}`,
      `[ÚLTIMAS MENSAGENS]`,
      formattedMessages || 'Nenhuma mensagem recente.',
      `---`,
      `Crie a exata resposta recomendada:`,
    ].join('\n');

    try {
      const text = await this.aiEngine.generateTextResponse({
        systemPrompt: basePrompt.join('\n'),
        userMessage,
        maxTokens: 100,
        temperature: 0.3,
      });

      await this.recordUsageUseCase.execute({
        tenantId,
        type: UsageType.AI_TOKEN,
        amount: toBillableAiTokens(50),
      });

      return {
        text: text.trim().replace(/^"|"$/g, ''),
      };
    } catch (err) {
      return {
        text: 'Falha ao processar rascunho na IA. Tente novamente mais tarde.',
      };
    }
  }

  private async resolveBranchId(
    tenantId: string,
    contactId: string,
  ): Promise<string | null> {
    try {
      const contact = await this.contactRepository.findById(
        tenantId,
        contactId,
      );
      return contact?.branchId ?? null;
    } catch {
      return null;
    }
  }
}
