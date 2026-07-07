import { Injectable, Optional } from '@nestjs/common';
import { PIIDetector } from '../../domain/services/PIIDetector';
import { PIIMasker } from '../../domain/services/PIIMasker';

export type ViolationType = 'PII_DETECTED' | 'EXTERNAL_URL' | 'TOXIC_CONTENT';

export interface GuardrailViolation {
  type: ViolationType;
  detail: string;
}

export interface GuardrailResult {
  safe: boolean;
  violations: GuardrailViolation[];
  sanitized: string;
}

const EXTERNAL_URL_PATTERN =
  /https?:\/\/(?!(?:wa\.me|api\.whatsapp\.com|m\.me|instagram\.com|t\.me))[^\s<>"']+/gi;

const TOXIC_PATTERNS = [
  /\bidiota\b/gi,
  /\bestupido\b/gi,
  /\bmerda\b/gi,
  /\bporra\b/gi,
  /\bviadinho\b/gi,
  /\bvsf\b/gi,
  /\bvai se foder\b/gi,
];

@Injectable()
export class OutputGuardrailService {
  private readonly detector: PIIDetector;
  private readonly masker: PIIMasker;

  constructor(
    @Optional() detector?: PIIDetector,
    @Optional() masker?: PIIMasker,
  ) {
    this.detector = detector ?? new PIIDetector();
    this.masker = masker ?? new PIIMasker(this.detector);
  }

  evaluate(text: string): GuardrailResult {
    const violations: GuardrailViolation[] = [];
    let sanitized = text;

    const piiMatches = this.detector.getMatches(text);
    if (piiMatches.length > 0) {
      for (const match of piiMatches) {
        violations.push({
          type: 'PII_DETECTED',
          detail: `${match.type} detected`,
        });
      }
      const maskResult = this.masker.mask(sanitized);
      sanitized = maskResult.masked;
    }

    const urlRegex = new RegExp(EXTERNAL_URL_PATTERN.source, 'gi');
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlRegex.exec(text)) !== null) {
      violations.push({
        type: 'EXTERNAL_URL',
        detail: `External URL detected: ${urlMatch[0].slice(0, 60)}`,
      });
      sanitized = sanitized.replace(urlMatch[0], '[link removido]');
    }

    for (const pattern of TOXIC_PATTERNS) {
      const regex = new RegExp(pattern.source, 'gi');
      if (regex.test(text)) {
        violations.push({
          type: 'TOXIC_CONTENT',
          detail: `Toxic pattern matched`,
        });
        sanitized = sanitized.replace(new RegExp(pattern.source, 'gi'), '***');
      }
    }

    return {
      safe: violations.length === 0,
      violations,
      sanitized,
    };
  }
}
