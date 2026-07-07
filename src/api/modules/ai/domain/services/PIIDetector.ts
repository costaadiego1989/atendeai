import { Injectable } from '@nestjs/common';

export interface PIIMatch {
  type: 'cpf' | 'credit_card' | 'email' | 'phone';
  value: string;
  index: number;
}

@Injectable()
export class PIIDetector {
  private static readonly CPF_FORMATTED = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
  private static readonly CPF_UNFORMATTED = /\b\d{11}\b/g;
  private static readonly CREDIT_CARD =
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
  private static readonly EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g;
  private static readonly PHONE_BR =
    /(?:\+55\s?)?\(?\d{2}\)?\s?\d{4,5}-?\d{4}\b/g;
  private static readonly CNPJ = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;

  hasPII(text: string): boolean {
    return this.getMatches(text).length > 0;
  }

  getMatches(text: string): PIIMatch[] {
    const matches: PIIMatch[] = [];
    const cnpjPositions = this.getCnpjPositions(text);

    this.findAll(
      text,
      PIIDetector.CPF_FORMATTED,
      'cpf',
      matches,
      cnpjPositions,
    );
    this.findUnformattedCPF(text, matches, cnpjPositions);
    this.findAll(
      text,
      PIIDetector.CREDIT_CARD,
      'credit_card',
      matches,
      cnpjPositions,
    );
    this.findEmails(text, matches);
    this.findPhones(text, matches);

    return matches;
  }

  private getCnpjPositions(text: string): Set<number> {
    const positions = new Set<number>();
    let match: RegExpExecArray | null;
    const regex = new RegExp(PIIDetector.CNPJ.source, 'g');
    while ((match = regex.exec(text)) !== null) {
      for (let i = match.index; i < match.index + match[0].length; i++) {
        positions.add(i);
      }
    }
    return positions;
  }

  private findAll(
    text: string,
    pattern: RegExp,
    type: PIIMatch['type'],
    matches: PIIMatch[],
    excludePositions: Set<number>,
  ): void {
    const regex = new RegExp(pattern.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (!excludePositions.has(match.index)) {
        matches.push({ type, value: match[0], index: match.index });
      }
    }
  }

  private findUnformattedCPF(
    text: string,
    matches: PIIMatch[],
    cnpjPositions: Set<number>,
  ): void {
    const regex = new RegExp(PIIDetector.CPF_UNFORMATTED.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (cnpjPositions.has(match.index)) continue;
      // Skip if it's part of a larger number (credit card, phone)
      const before = text[match.index - 1];
      const after = text[match.index + match[0].length];
      if (before && /\d/.test(before)) continue;
      if (after && /\d/.test(after)) continue;
      matches.push({ type: 'cpf', value: match[0], index: match.index });
    }
  }

  private findEmails(text: string, matches: PIIMatch[]): void {
    const regex = new RegExp(PIIDetector.EMAIL.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      // Must have @ to be email (already in pattern) and a valid TLD
      if (match[0].includes('@')) {
        matches.push({ type: 'email', value: match[0], index: match.index });
      }
    }
  }

  private findPhones(text: string, matches: PIIMatch[]): void {
    const regex = new RegExp(PIIDetector.PHONE_BR.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      // Must be at least 10 digits to be a real phone
      const digits = match[0].replace(/\D/g, '');
      if (digits.length >= 10) {
        matches.push({ type: 'phone', value: match[0], index: match.index });
      }
    }
  }
}
