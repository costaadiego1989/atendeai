export interface NegotiationRules {
  maxDiscountPercent: number;
  maxInstallments: number;
  minInstallmentValue: number;
  allowedPaymentMethods: ('PIX' | 'BOLETO' | 'CREDIT_CARD')[];
}

export interface VoiceAgentConfig {
  id: string;
  tenantId: string;
  enabled: boolean;
  voiceId: string;
  language: string;
  maxDiscountPercent: number;
  maxInstallments: number;
  minInstallmentValue: number;
  callWindowStart: string;
  callWindowEnd: string;
  blockedDays: string[];
  greeting?: string | null;
  transferPhone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function isWithinCallWindow(config: VoiceAgentConfig): boolean {
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  if (config.blockedDays.includes(day)) return false;

  const [startH, startM] = config.callWindowStart.split(':').map(Number);
  const [endH, endM] = config.callWindowEnd.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

export function buildNegotiationRules(config: VoiceAgentConfig): NegotiationRules {
  return {
    maxDiscountPercent: config.maxDiscountPercent,
    maxInstallments: config.maxInstallments,
    minInstallmentValue: config.minInstallmentValue,
    allowedPaymentMethods: ['PIX', 'BOLETO', 'CREDIT_CARD'],
  };
}
