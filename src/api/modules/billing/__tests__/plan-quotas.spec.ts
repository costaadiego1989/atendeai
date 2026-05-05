import { PLAN_QUOTAS } from '../domain/constants/PlanQuotas';
import { MIN_BILLABLE_TOKENS_PER_AI_MESSAGE } from '../domain/constants/AiTokenBillingPolicy';

describe('Plan quotas (business invariants)', () => {
  it('should allow at least 30 automatic messages per contact', () => {
    for (const [plan, quotas] of Object.entries(PLAN_QUOTAS)) {
      const minMessages = quotas.contacts * 30;
      expect(quotas.messages).toBeGreaterThanOrEqual(minMessages);
    }
  });

  it('should provide a realistic minimum AI token budget per contact', () => {
    for (const [plan, quotas] of Object.entries(PLAN_QUOTAS)) {
      const minTokens = quotas.contacts * 30 * MIN_BILLABLE_TOKENS_PER_AI_MESSAGE;
      expect(quotas.aiTokens).toBeGreaterThanOrEqual(minTokens);
    }
  });
});

