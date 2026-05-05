export const AI_TOKEN_BILLING_MULTIPLIER = 3;

export const MIN_BILLABLE_TOKENS_PER_AI_MESSAGE = 100;

/**
 * `tokensUsed` vem do engine e normalmente não inclui todo o contexto (system prompt + histórico).
 * Para refletir custo real (e manter previsibilidade de negócio), cobramos um multiplicador fixo.
 */
export function toBillableAiTokens(tokensUsed: number): number {
  const safe = Number.isFinite(tokensUsed) ? tokensUsed : 0;
  if (safe <= 0) return 0;
  return Math.ceil(safe * AI_TOKEN_BILLING_MULTIPLIER);
}

