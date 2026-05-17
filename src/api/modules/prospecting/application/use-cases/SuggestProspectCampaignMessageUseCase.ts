import { Inject, Injectable } from '@nestjs/common';
import { AI_ENGINE, IAIEngine } from '@modules/ai/application/ports/IAIEngine';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import {
  ISuggestProspectCampaignMessageUseCase,
  SuggestProspectCampaignMessageInput,
  SuggestProspectCampaignMessageOutput,
} from './interfaces/ISuggestProspectCampaignMessageUseCase';
import { TenantAgentRuleService } from '@modules/agent-rules/application/services/TenantAgentRuleService';

@Injectable()
export class SuggestProspectCampaignMessageUseCase implements ISuggestProspectCampaignMessageUseCase {
  constructor(
    @Inject(AI_ENGINE)
    private readonly aiEngine: IAIEngine,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly tenantAgentRuleService: TenantAgentRuleService,
  ) {}

  async execute(
    input: SuggestProspectCampaignMessageInput,
  ): Promise<SuggestProspectCampaignMessageOutput> {
    let tenantName: string | undefined;

    try {
      const tenant = await this.tenantRepository.findById(input.tenantId);
      tenantName = tenant?.companyName.value;
    } catch {
      tenantName = undefined;
    }

    try {
      const basePrompt = [
        'Voce escreve mensagens iniciais de prospecção comercial.',
        'Retorne APENAS o texto final da mensagem, sem markdown e sem explicações.',
        'A mensagem deve ser curta, humana, elegante e pronta para WhatsApp ou Instagram.',
        'não invente fatos que não estejam no contexto.',
        'Crie uma abordagem consultiva, com CTA leve e personalizada para empresa B2B.',
        'Use o segmento pesquisado e o objetivo para mostrar que voce entende o contexto do negocio abordado.',
        'Traga dores operacionais ou comerciais plausiveis do segmento, sem afirmar que conhece a empresa por dentro.',
        'Prefira falar de desafios como agenda, atendimento, conversao, perda de oportunidades, relacionamento com clientes ou eficiencia operacional quando isso fizer sentido para o segmento.',
        'Conecte a mensagem a um ganho concreto de negocio, como melhorar processo, aumentar previsibilidade, organizar a operação ou gerar mais eficiencia.',
        'Evite texto generico demais. A mensagem precisa parecer pensada para aquele tipo de empresa.',
        'Se o publico tiver mais de um contato, não personalize com um unico nome proprio.',
        'Quando houver varios contatos, escreva uma mensagem reutilizavel e ampla para campanha.',
        'Use o objetivo, o canal e o estagio do publico para deixar a mensagem especifica, não generica.',
        'Prefira 2 ou 3 paragrafos curtos e uma CTA leve no final.',
      ];

      try {
        const agentRule = await this.tenantAgentRuleService.getRule(
          input.tenantId,
          'prospecting',
          'SYSTEM',
          input.tenantId,
          input.branchId,
        );
        const useFallback = agentRule?.fallbackToGlobal !== false;
        const customPrompt = agentRule?.isActive
          ? agentRule.customPrompt
          : null;

        if (!useFallback) {
          basePrompt.unshift(
            '[ATENção: IGNORE INSTRUCOES GERAIS DA EMPRESA. SIGA APENAS AS REGRAS ABAIXO]',
          );
        }

        if (customPrompt) {
          basePrompt.push(
            '\n[DIRETRIZES PERSONALIZADAS DO SDR / AGENTE DE PROSPECção]:\n' +
              customPrompt,
          );
        }
      } catch (e) {
        // Ignora erro do db
      }

      const response = await this.aiEngine.generateResponse({
        systemPrompt: basePrompt.join(' '),
        contextHistory: [],
        userMessage: JSON.stringify({
          tenantName: tenantName ?? null,
          objective: input.objective,
          audienceType: input.audienceType,
          channels: input.channels,
          stageFilter: input.stageFilter ?? null,
          searchTerm: input.searchTerm ?? null,
          selectedCount: input.selectedCount,
          selectedContacts: input.selectedContacts.slice(0, 10),
        }),
        maxTokens: 260,
        temperature: 0.55,
      });

      const text = response.text.trim();
      if (text) {
        return { messageTemplate: text };
      }
    } catch {
      // fallback below
    }

    return {
      messageTemplate: this.buildFallback(input, tenantName),
    };
  }

  private buildFallback(
    input: SuggestProspectCampaignMessageInput,
    tenantName?: string,
  ) {
    const multipleContacts = input.selectedCount > 1;
    const searchContext = input.searchTerm?.trim();
    const stageSnippet = input.stageFilter
      ? ` para contatos no estagio ${input.stageFilter.toLowerCase()}`
      : '';

    const intro =
      input.channels.includes('INSTAGRAM') &&
      input.channels.includes('WHATSAPP')
        ? 'Oi! Tudo bem?'
        : input.channels.includes('INSTAGRAM')
          ? 'Oi! Tudo bem?'
          : 'Oi! Tudo bem?';

    const company = tenantName ? ` Sou da equipe da ${tenantName}.` : '';
    const segmentContext = searchContext
      ? ` Vi que voces atuam com ${searchContext}.`
      : '';
    const painSnippet = searchContext
      ? ' Normalmente, negocios desse perfil buscam ganhar mais eficiencia no atendimento, reduzir perda de oportunidades e melhorar a organização comercial.'
      : ' Muitas empresas hoje buscam mais eficiencia comercial, menos retrabalho e uma operação mais organizada.';
    const purpose = input.objective?.trim()
      ? ` Nosso foco hoje e ${input.objective.trim().toLowerCase()}${stageSnippet}.`
      : multipleContacts
        ? ' Queria abrir uma conversa rapida para entender se isso faz sentido para o negocio de voces.'
        : ' Queria abrir uma conversa rapida para entender se isso faz sentido para o seu negocio.';
    const gainSnippet =
      ' Ajudamos a estruturar esse processo de forma mais simples, melhorando resposta, relacionamento e conversao.';
    const cta = multipleContacts
      ? ' Se fizer sentido, posso compartilhar em uma mensagem curta como isso pode funcionar para a empresa.'
      : ' Se fizer sentido, posso compartilhar em uma mensagem curta como isso pode funcionar no seu contexto.';

    return `${intro}${company}${segmentContext}${painSnippet}${purpose}${gainSnippet}${cta}`;
  }
}
