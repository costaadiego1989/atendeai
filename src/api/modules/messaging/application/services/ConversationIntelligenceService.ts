import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CONVERSATION_INTELLIGENCE_REPOSITORY,
  ConversationSentiment,
  IConversationIntelligenceRepository,
} from '../../domain/repositories/IConversationIntelligenceRepository';

interface AnalyzeMessageInput {
  tenantId: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  sentBy: 'CONTACT' | 'AI' | 'HUMAN' | 'SYSTEM';
  text: string;
  options?: { tx?: Prisma.TransactionClient };
}

@Injectable()
export class ConversationIntelligenceService {
  constructor(
    @Inject(CONVERSATION_INTELLIGENCE_REPOSITORY)
    private readonly intelligenceRepository: IConversationIntelligenceRepository,
  ) {}

  async captureMessageSignal(input: AnalyzeMessageInput): Promise<void> {
    const text = input.text.trim();
    if (!text) {
      return;
    }

    const analysis = this.analyze(text, input.direction, input.sentBy);
    await this.intelligenceRepository.save(
      {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        ...analysis,
      },
      input.options,
    );
  }

  private analyze(
    text: string,
    direction: 'INBOUND' | 'OUTBOUND',
    sentBy: 'CONTACT' | 'AI' | 'HUMAN' | 'SYSTEM',
  ) {
    const normalized = this.normalize(text);
    const tags = new Set<string>();
    const interests = new Set<string>();

    if (
      /(preço|valor|quanto|orcamento|pagar|pix|boleto|cartao)/i.test(normalized)
    ) {
      tags.add('financeiro');
      interests.add('preço');
    }
    if (
      /(agenda|horário|marcar|remarcar|consulta|disponivel)/i.test(normalized)
    ) {
      tags.add('agenda');
      interests.add('agendamento');
    }
    if (/(entrega|frete|retirada|endereço|bairro)/i.test(normalized)) {
      tags.add('checkout');
      interests.add('entrega');
    }
    if (/(produto|item|catalogo|comprar|pedido)/i.test(normalized)) {
      tags.add('venda');
      interests.add('produto');
    }
    if (
      /(problema|reclama|ruim|erro|atras|cancelar|devolver)/i.test(normalized)
    ) {
      tags.add('risco');
    }

    const sentiment = this.resolveSentiment(normalized);
    const lossReason = this.resolveLossReason(normalized);
    const nextStep = this.resolveNextStep({
      direction,
      sentBy,
      tags: [...tags],
      sentiment,
    });

    return {
      summary: this.buildSummary(text, direction, sentBy),
      sentiment,
      tags: [...tags],
      interests: [...interests],
      nextStep,
      lossReason,
    };
  }

  private buildSummary(
    text: string,
    direction: 'INBOUND' | 'OUTBOUND',
    sentBy: 'CONTACT' | 'AI' | 'HUMAN' | 'SYSTEM',
  ) {
    const author =
      direction === 'INBOUND' ? 'Cliente' : sentBy === 'AI' ? 'IA' : 'Operador';
    const compact = text.replace(/\s+/g, ' ').slice(0, 180);
    return `${author}: ${compact}`;
  }

  private normalize(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private resolveSentiment(normalized: string): ConversationSentiment {
    if (
      /(obrigad|perfeito|gostei|bom|otimo|fechado|quero|sim)/i.test(normalized)
    ) {
      return 'POSITIVE';
    }

    if (
      /(ruim|problema|cancelar|caro|demora|reclama|insatisfeito|não quero)/i.test(
        normalized,
      )
    ) {
      return 'NEGATIVE';
    }

    return 'NEUTRAL';
  }

  private resolveLossReason(normalized: string): string | null {
    if (/(caro|preço alto|sem dinheiro)/i.test(normalized)) {
      return 'preço';
    }
    if (/(não quero|sem interesse|agora não)/i.test(normalized)) {
      return 'sem_interesse';
    }
    if (/(cancelar|desist)/i.test(normalized)) {
      return 'cancelamento';
    }
    return null;
  }

  private resolveNextStep(input: {
    direction: 'INBOUND' | 'OUTBOUND';
    sentBy: 'CONTACT' | 'AI' | 'HUMAN' | 'SYSTEM';
    tags: string[];
    sentiment: ConversationSentiment;
  }): string {
    if (input.direction === 'OUTBOUND') {
      return input.sentBy === 'AI'
        ? 'Acompanhar resposta do cliente e assumir se houver objeção.'
        : 'Aguardar retorno do cliente.';
    }

    if (input.sentiment === 'NEGATIVE') {
      return 'Priorizar atendimento humano e tratar objeção com cuidado.';
    }
    if (input.tags.includes('financeiro')) {
      return 'Enviar cobrança, proposta ou esclarecer condicoes de pagamento.';
    }
    if (input.tags.includes('agenda')) {
      return 'Oferecer horários disponiveis ou confirmar agendamento.';
    }
    if (input.tags.includes('checkout')) {
      return 'Validar entrega, frete e avanço do checkout.';
    }
    if (input.tags.includes('venda')) {
      return 'Recomendar opções e conduzir para o próximo passo da compra.';
    }

    return 'Responder a mensagem e manter a conversa avançando.';
  }
}
