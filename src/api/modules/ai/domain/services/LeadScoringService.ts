import { Injectable } from '@nestjs/common';

export type IntentType =
  | 'PURCHASE'
  | 'QUESTION'
  | 'COMPLAINT'
  | 'GREETING'
  | 'GENERAL';
export type SentimentType = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

@Injectable()
export class LeadScoringService {
  calculateScore(
    intent: IntentType,
    sentiment: SentimentType,
    confidence: number,
  ): number {
    let score = 0;

    switch (intent) {
      case 'PURCHASE':
        score += 50;
        break;
      case 'QUESTION':
        score += 20;
        break;
      case 'GENERAL':
        score += 10;
        break;
      default:
        score += 0;
    }

    switch (sentiment) {
      case 'POSITIVE':
        score += 30;
        break;
      case 'NEUTRAL':
        score += 10;
        break;
      case 'NEGATIVE':
        score -= 20;
        break;
    }

    if (confidence > 0.9) {
      score += 20;
    } else if (confidence > 0.7) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  isHotLead(score: number): boolean {
    return score >= 80;
  }
}
