export const PLAN_PRICES: Record<string, number> = {
  ESSENCIAL: Number(process.env.PLAN_PRICE_ESSENCIAL) || 297,
  PROFISSIONAL: Number(process.env.PLAN_PRICE_PROFISSIONAL) || 597,
  ESCALA: Number(process.env.PLAN_PRICE_ESCALA) || 967,
};
