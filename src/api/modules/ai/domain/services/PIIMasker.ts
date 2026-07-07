import { Injectable, Optional } from '@nestjs/common';
import { PIIDetector, PIIMatch } from './PIIDetector';

export interface MaskingResult {
  masked: string;
  originalLength: number;
  maskedCount: number;
  maskMap: MaskEntry[];
}

export interface MaskEntry {
  type: PIIMatch['type'];
  original: string;
  masked: string;
  index: number;
}

const MASK_PATTERNS: Record<PIIMatch['type'], (value: string) => string> = {
  cpf: (v) => {
    if (v.includes('.')) return '***.***.***-**';
    return '***********';
  },
  credit_card: () => '**** **** **** ****',
  email: (v) => {
    const [local, domain] = v.split('@');
    const maskedLocal =
      local.length <= 2
        ? '**'
        : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
    return `${maskedLocal}@${domain}`;
  },
  phone: (v) => {
    const digits = v.replace(/\D/g, '');
    if (digits.length <= 4) return '****';
    return '*'.repeat(digits.length - 4) + digits.slice(-4);
  },
};

@Injectable()
export class PIIMasker {
  private readonly detector: PIIDetector;

  constructor(@Optional() detector?: PIIDetector) {
    this.detector = detector ?? new PIIDetector();
  }

  mask(text: string): MaskingResult {
    const matches = this.detector.getMatches(text);

    if (matches.length === 0) {
      return {
        masked: text,
        originalLength: text.length,
        maskedCount: 0,
        maskMap: [],
      };
    }

    // Sort by index descending so replacements don't shift positions
    const sorted = [...matches].sort((a, b) => b.index - a.index);
    let result = text;
    const maskMap: MaskEntry[] = [];

    for (const match of sorted) {
      const maskFn = MASK_PATTERNS[match.type];
      const maskedValue = maskFn(match.value);
      result =
        result.slice(0, match.index) +
        maskedValue +
        result.slice(match.index + match.value.length);
      maskMap.push({
        type: match.type,
        original: match.value,
        masked: maskedValue,
        index: match.index,
      });
    }

    return {
      masked: result,
      originalLength: text.length,
      maskedCount: sorted.length,
      maskMap: maskMap.reverse(), // Return in original order
    };
  }

  hasPII(text: string): boolean {
    return this.detector.hasPII(text);
  }
}
