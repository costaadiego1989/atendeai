import { Injectable } from '@nestjs/common';

@Injectable()
export class RecoveryReplyPolicy {
  private readonly stopKeywords = [
    'pare',
    'parar',
    'sair',
    'cancelar',
    'não me mande',
    'não me mande',
    'não quero receber',
    'não quero receber',
  ];

  private readonly promiseKeywords = [
    'vou pagar',
    'vou quitar',
    'vou regularizar',
    'pago hoje',
    'pago amanha',
    'pago amanhã',
    'amanha eu pago',
    'amanhã eu pago',
    'consigo pagar',
    'vou fazer o pagamento',
    'vou te pagar',
    'pix hoje',
  ];

  classify(messageText?: string): 'STOPPED' | 'PROMISE_TO_PAY' | 'NEGOTIATING' {
    const normalizedText = this.normalize(messageText);

    if (!normalizedText) {
      return 'NEGOTIATING';
    }

    if (
      this.stopKeywords.some((keyword) =>
        normalizedText.includes(this.normalize(keyword)),
      )
    ) {
      return 'STOPPED';
    }

    if (
      this.promiseKeywords.some((keyword) =>
        normalizedText.includes(this.normalize(keyword)),
      )
    ) {
      return 'PROMISE_TO_PAY';
    }

    return 'NEGOTIATING';
  }

  private normalize(value?: string): string {
    if (!value) {
      return '';
    }

    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
