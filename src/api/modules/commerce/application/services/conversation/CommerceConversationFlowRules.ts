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
    const match = value.match(/\b(\d{1,2})\b/);
    if (!match) {
      return null;
    }

    const number = Number(match[1]);
    return Number.isInteger(number) && number > 0 ? number : null;
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
