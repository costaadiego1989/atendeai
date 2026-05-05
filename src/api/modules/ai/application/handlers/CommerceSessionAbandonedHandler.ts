import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/event-bus';
import { IProcessAIResponseUseCase } from '../use-cases/interfaces/IProcessAIResponseUseCase';
import { CommerceSessionAbandonedIntegrationEvent } from '@modules/commerce/application/integration-events/CheckoutIntegrationEvents';

@Injectable()
export class CommerceSessionAbandonedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(IProcessAIResponseUseCase)
    private readonly processAIResponseUseCase: IProcessAIResponseUseCase,
  ) { }

  onModuleInit() {
    this.eventBus.subscribe<CommerceSessionAbandonedIntegrationEvent>(
      'commerce.session.abandoned',
      async (event) => {
        await this.handle(event.payload);
      },
      { consumerName: 'ai-commerce-session-abandoned' },
    );
  }

  private async handle(
    payload: CommerceSessionAbandonedIntegrationEvent['payload'],
  ) {
    if (
      typeof payload.conversationId !== 'string' ||
      !payload.conversationId ||
      typeof payload.contactId !== 'string' ||
      !payload.contactId
    ) {
      return;
    }

    const interval =
      typeof payload.interval === 'string' && payload.interval
        ? payload.interval
        : '1h';
    const subtotal =
      typeof payload.subtotalAmount === 'number'
        ? payload.subtotalAmount.toFixed(2)
        : null;
    const total =
      typeof payload.totalAmount === 'number'
        ? payload.totalAmount.toFixed(2)
        : null;
    const currentStep =
      typeof payload.currentStep === 'string'
        ? payload.currentStep
        : 'BUILDING_CART';

    const hints: string[] = [
      '[SISTEMA: O cliente abandonou um carrinho conversacional no checkout.]',
      `[SISTEMA: Intervalo da retomada: ${interval}.]`,
      `[SISTEMA: Etapa atual do checkout: ${currentStep}.]`,
      '[SISTEMA: Reengaje com tom comercial, leve e objetivo, sem parecer cobrança agressiva.]',
      '[SISTEMA: Convide o cliente a concluir a compra ou tirar duvidas sobre entrega, pagamento ou itens.]',
      ...this.buildIntervalInstructions(interval),
    ];

    if (subtotal) {
      hints.push(`[SISTEMA: Subtotal atual do carrinho: R$ ${subtotal}.]`);
    }

    if (total) {
      hints.push(`[SISTEMA: Total atual estimado do pedido: R$ ${total}.]`);
    }

    await this.processAIResponseUseCase.execute({
      conversationId: payload.conversationId,
      tenantId: String(payload.tenantId),
      contactId: payload.contactId,
      content: {
        type: 'TEXT',
        text: `${hints.join(' ')} Gere uma mensagem curta para retomar este carrinho abandonado.`,
      },
    });
  }

  private buildIntervalInstructions(interval: string): string[] {
    switch (interval) {
      case '1h':
        return [
          '[SISTEMA: Este e o primeiro lembrete. Assuma que o cliente pode ter apenas se distraido.]',
          '[SISTEMA: Seja breve, acolhedor e focado em facilitar a retomada imediata do pedido.]',
        ];
      case '1d':
        return [
          '[SISTEMA: Esta retomada acontece depois de 1 dia. Reforce ajuda pratica e resolução de objecoes.]',
          '[SISTEMA: Sugira apoio sobre entrega, pagamento, disponibilidade ou ajuste do pedido.]',
        ];
      case '7d':
        return [
          '[SISTEMA: Esta retomada acontece depois de 7 dias. Use um ultimo toque elegante de reativação.]',
          '[SISTEMA: Diga que ainda pode ajudar se o cliente quiser concluir, revisar ou montar um novo pedido.]',
        ];
      default:
        return [
          '[SISTEMA: Use uma retomada neutra e objetiva para reengajar este checkout.]',
        ];
    }
  }
}
