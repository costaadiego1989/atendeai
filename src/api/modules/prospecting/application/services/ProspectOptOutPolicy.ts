import { Injectable } from '@nestjs/common';

@Injectable()
export class ProspectOptOutPolicy {
  private readonly stopPhrases = [
    'pare',
    'parar',
    'sair',
    'remover',
    'não quero mais',
    'não quero mais',
    'não quero receber',
    'não quero receber',
    'pare de me mandar',
    'descadastrar',
  ];

  shouldStop(messageText: string | undefined): boolean {
    const normalized = (messageText ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    if (!normalized) {
      return false;
    }

    return this.stopPhrases.some((phrase) => normalized.includes(phrase));
  }
}
