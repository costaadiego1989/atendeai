import { Injectable } from '@nestjs/common';

@Injectable()
export class GenerateAbandonmentMessageUseCase {
  async execute(tenantId: string): Promise<{ message: string }> {
    const templates = [
      "Oi {nome}! Vi que você deixou alguns itens no carrinho 🛒 Posso te ajudar a finalizar o pedido?",
      "Olá {nome}, tudo bem? Notei que o seu pedido não foi concluído. Quer ajuda com algo?",
      "Oie {nome}! Seus produtos ainda estão te esperando 🛍️ Vamos finalizar a compra?",
    ];

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];

    return {
      message: randomTemplate,
    };
  }
}
