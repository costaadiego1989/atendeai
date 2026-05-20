import { Injectable, Logger } from '@nestjs/common';
import {
  NegotiationRules,
  buildNegotiationRules,
  VoiceAgentConfig,
} from '../../domain/value-objects/NegotiationRules';

export interface NegotiationContext {
  debtorName: string;
  amountDue: number;
  dueDate: string;
  daysOverdue: number;
  chargeTitle: string;
  previousAttempts: number;
}

export interface NegotiationOffer {
  type: 'FULL_PAYMENT' | 'DISCOUNT' | 'INSTALLMENT';
  discountPercent: number;
  installments: number;
  installmentValue: number;
  totalValue: number;
}

export interface NegotiationPrompt {
  systemPrompt: string;
  greeting: string;
  offers: NegotiationOffer[];
}

@Injectable()
export class VoiceNegotiationService {
  private readonly logger = new Logger(VoiceNegotiationService.name);

  /**
   * Builds the negotiation prompt and available offers based on
   * the tenant's rules and the debtor's context.
   */
  buildNegotiationPrompt(
    config: VoiceAgentConfig,
    context: NegotiationContext,
  ): NegotiationPrompt {
    const rules = buildNegotiationRules(config);
    const offers = this.calculateOffers(context.amountDue, rules);

    const systemPrompt = this.buildSystemPrompt(config, context, rules, offers);
    const greeting = this.buildGreeting(config, context);

    return { systemPrompt, greeting, offers };
  }

  /**
   * Evaluates if a customer's counter-offer is acceptable within rules.
   */
  evaluateCounterOffer(
    requestedDiscount: number,
    requestedInstallments: number,
    amountDue: number,
    config: VoiceAgentConfig,
  ): { acceptable: boolean; reason?: string; bestOffer?: NegotiationOffer } {
    const rules = buildNegotiationRules(config);

    if (requestedDiscount > rules.maxDiscountPercent) {
      return {
        acceptable: false,
        reason: `Desconto máximo permitido é ${rules.maxDiscountPercent}%`,
        bestOffer: {
          type: 'DISCOUNT',
          discountPercent: rules.maxDiscountPercent,
          installments: 1,
          installmentValue: amountDue * (1 - rules.maxDiscountPercent / 100),
          totalValue: amountDue * (1 - rules.maxDiscountPercent / 100),
        },
      };
    }

    if (requestedInstallments > rules.maxInstallments) {
      return {
        acceptable: false,
        reason: `Máximo de ${rules.maxInstallments} parcelas`,
        bestOffer: {
          type: 'INSTALLMENT',
          discountPercent: 0,
          installments: rules.maxInstallments,
          installmentValue: amountDue / rules.maxInstallments,
          totalValue: amountDue,
        },
      };
    }

    const installmentValue = (amountDue * (1 - requestedDiscount / 100)) / requestedInstallments;
    if (installmentValue < rules.minInstallmentValue) {
      return {
        acceptable: false,
        reason: `Parcela mínima é R$ ${rules.minInstallmentValue.toFixed(2)}`,
      };
    }

    return { acceptable: true };
  }

  private calculateOffers(amountDue: number, rules: NegotiationRules): NegotiationOffer[] {
    const offers: NegotiationOffer[] = [];

    // Option 1: Full payment with max discount
    if (rules.maxDiscountPercent > 0) {
      const discounted = amountDue * (1 - rules.maxDiscountPercent / 100);
      offers.push({
        type: 'DISCOUNT',
        discountPercent: rules.maxDiscountPercent,
        installments: 1,
        installmentValue: discounted,
        totalValue: discounted,
      });
    }

    // Option 2: Full payment without discount
    offers.push({
      type: 'FULL_PAYMENT',
      discountPercent: 0,
      installments: 1,
      installmentValue: amountDue,
      totalValue: amountDue,
    });

    // Option 3: Installments
    if (rules.maxInstallments > 1) {
      const installmentValue = amountDue / rules.maxInstallments;
      if (installmentValue >= rules.minInstallmentValue) {
        offers.push({
          type: 'INSTALLMENT',
          discountPercent: 0,
          installments: rules.maxInstallments,
          installmentValue,
          totalValue: amountDue,
        });
      }
    }

    return offers;
  }

  private buildGreeting(config: VoiceAgentConfig, context: NegotiationContext): string {
    if (config.greeting) {
      return config.greeting
        .replace('{nome}', context.debtorName)
        .replace('{valor}', `R$ ${context.amountDue.toFixed(2)}`)
        .replace('{servico}', context.chargeTitle);
    }

    return `Olá ${context.debtorName}, aqui é da equipe de cobrança. Estou entrando em contato sobre um débito de R$ ${context.amountDue.toFixed(2)} referente a ${context.chargeTitle}, com vencimento em ${context.dueDate}. Gostaria de resolver isso agora?`;
  }

  private buildSystemPrompt(
    _config: VoiceAgentConfig,
    context: NegotiationContext,
    rules: NegotiationRules,
    offers: NegotiationOffer[],
  ): string {
    const offersText = offers
      .map((o, i) => {
        if (o.type === 'DISCOUNT') {
          return `${i + 1}. À vista com ${o.discountPercent}% de desconto: R$ ${o.totalValue.toFixed(2)}`;
        }
        if (o.type === 'INSTALLMENT') {
          return `${i + 1}. Parcelado em ${o.installments}x de R$ ${o.installmentValue.toFixed(2)}`;
        }
        return `${i + 1}. Pagamento integral: R$ ${o.totalValue.toFixed(2)}`;
      })
      .join('\n');

    return `Você é um agente de cobrança profissional, empático e objetivo.

CONTEXTO DO DÉBITO:
- Devedor: ${context.debtorName}
- Valor: R$ ${context.amountDue.toFixed(2)}
- Serviço: ${context.chargeTitle}
- Vencimento: ${context.dueDate}
- Dias em atraso: ${context.daysOverdue}
- Tentativas anteriores: ${context.previousAttempts}

REGRAS DE NEGOCIAÇÃO:
- Desconto máximo: ${rules.maxDiscountPercent}%
- Parcelas máximas: ${rules.maxInstallments}x
- Parcela mínima: R$ ${rules.minInstallmentValue.toFixed(2)}

OFERTAS DISPONÍVEIS:
${offersText}

COMPORTAMENTO:
1. Seja cordial mas direto
2. Informe o débito de forma clara
3. Pergunte se deseja resolver agora
4. Se sim, apresente as opções de pagamento
5. Se aceitar, confirme e informe que enviará o link de pagamento
6. Se recusar, pergunte o motivo e registre
7. Se pedir para falar com supervisor, transfira imediatamente
8. Nunca ameace ou pressione
9. Respeite se pedir para não ligar mais (opt-out)
10. Mantenha tom profissional e empático em PT-BR`;
  }
}
