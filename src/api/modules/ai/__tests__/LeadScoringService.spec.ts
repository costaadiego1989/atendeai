import { LeadScoringService } from '../domain/services/LeadScoringService';

describe('LeadScoringService', () => {
  let service: LeadScoringService;

  beforeEach(() => {
    service = new LeadScoringService();
  });

  it('should give a high score to a confident purchase intent and cap it at 100', () => {
    const score = service.calculateScore('PURCHASE', 'POSITIVE', 0.95);

    expect(score).toBe(100);
    expect(service.isHotLead(score)).toBe(true);
  });

  it('should reduce score for negative sentiment and never go below zero', () => {
    const score = service.calculateScore('GENERAL', 'NEGATIVE', 0.2);

    expect(score).toBe(0);
    expect(service.isHotLead(score)).toBe(false);
  });

  it('should produce a medium score for neutral questions with moderate confidence', () => {
    const score = service.calculateScore('QUESTION', 'NEUTRAL', 0.75);

    expect(score).toBe(40);
    expect(service.isHotLead(score)).toBe(false);
  });
});
