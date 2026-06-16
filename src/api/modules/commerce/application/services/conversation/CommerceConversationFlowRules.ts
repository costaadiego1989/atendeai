import { Injectable } from '@nestjs/common';
import { CommercePendingOptionRecord } from '../../../domain/ports/ICommerceRepository';

@Injectable()
export class CommerceConversationFlowRules {
  resolveSelectedOption(
    options: CommercePendingOptionRecord[],
    normalizedMessage: string,
  ) {
    const optionNumber = this.extractPositiveInteger(normalizedMessage);
    if (optionNumber == null) {
      return null;
    }

    return (
      options.find((option) => option.optionNumber === optionNumber) ?? null
    );
  }

  extractPositiveInteger(value: string) {
    // Match a standalone 1-3 digit integer that is NOT part of a negative
    // number ("-3") or a decimal ("2.5"/"2,5"). Rejects those instead of
    // silently coercing them to a positive integer.
    const match = value.match(/(?<![\d.,-])(\d{1,3})(?![\d.,])/);
    if (!match) {
      return null;
    }

    const number = Number(match[1]);
    return Number.isInteger(number) && number > 0 ? number : null;
  }

  /**
   * Global "escape hatch" intent: the customer wants to restart the flow or go
   * back to the initial menu. Recognized from ANY step so a customer can never
   * get stuck in the conversational state machine.
   */
  isResetIntent(value: string) {
    const normalized = this.normalize(value);

    // Unambiguous multi-word phrases match anywhere in the message.
    const phrases = [
      'voltar ao menu',
      'voltar ao inicio',
      'voltar pro menu',
      'menu inicial',
      'comecar de novo',
      'comecar denovo',
      'cancelar tudo',
      'cancela tudo',
    ];
    if (phrases.some((p) => normalized.includes(p))) {
      return true;
    }

    // Short, ambiguous keywords only count as a reset when they are the gist of
    // a short message (whole word, <= 3 words). Avoids false positives like
    // "vou voltar mais tarde para comprar" or "nao quero cancelar agora".
    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length > 3) {
      return false;
    }
    const keywords = [
      'menu',
      'reiniciar',
      'reinicio',
      'recomecar',
      'recomeco',
      'voltar',
      'cancelar',
      'cancela',
    ];
    return words.some((w) => keywords.includes(w));
  }

  isNegativeOrCheckout(value: string) {
    return [
      'não',
      'não',
      'so isso',
      'só isso',
      'fechar pedido',
      'finalizar',
      'checkout',
      'terminou',
      'pode fechar',
    ].some((token) => value.includes(this.normalize(token)));
  }

  isPickup(value: string) {
    return ['retirada', 'retirar', 'buscar', 'pickup'].some((token) =>
      value.includes(this.normalize(token)),
    );
  }

  isDelivery(value: string) {
    return ['entrega', 'entregar', 'delivery'].some((token) =>
      value.includes(this.normalize(token)),
    );
  }

  isPaymentIntent(value: string) {
    return [
      'pode mandar o link',
      'manda o link',
      'pagar',
      'pode cobrar',
      'fechar pedido',
      'finalizar pedido',
      'checkout',
      'pode finalizar',
    ].some((token) => value.includes(this.normalize(token)));
  }

  isSkipOrderNote(value: string) {
    return [
      'sem observação',
      'sem observações',
      'nenhuma observação',
      'nenhuma observação',
      'não',
      'não',
      'sem recado',
      'sem nota',
      'tudo certo',
    ].some((token) => value.includes(this.normalize(token)));
  }

  looksLikeAddress(value: string) {
    const normalized = this.normalize(value);
    return (
      normalized.length >= 10 &&
      (normalized.includes('rua') ||
        normalized.includes('avenida') ||
        normalized.includes('av ') ||
        normalized.includes('travessa') ||
        normalized.includes('estrada') ||
        /\d/.test(normalized))
    );
  }

  isTransactionalBusiness(businessType?: string | null) {
    if (!businessType) {
      return false;
    }

    const normalized = this.normalize(businessType);
    return [
      'retail',
      'food',
      'ecommerce',
      'supermarket',
      'market',
      'grocery',
      'bakery',
      'cafeteria',
      'e-commerce',
      'varejo',
      'delivery',
      'restaurante',
      'restaurantes',
      'supermercado',
      'mercado',
      'mercearia',
      'padaria',
      'cafeteria',
    ].includes(normalized);
  }

  normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
