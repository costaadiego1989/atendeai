import { IPaymentLinkGenerator } from '../ports/IPaymentLinkGenerator';
import { IReserveProfessionalSlot } from '../ports/IReserveProfessionalSlot';

export class AIResponseProcessor {
  constructor(
    private readonly paymentLinkGenerator: IPaymentLinkGenerator,
    private readonly reserveProfessionalSlotUseCase?: IReserveProfessionalSlot,
  ) { }

  public async process(
    text: string,
    input:
      | string
      | {
        tenantId: string;
        branchId?: string | null;
        contactId?: string;
        conversationId?: string;
      },
  ): Promise<string> {
    let processedText = text;
    const tenantId = typeof input === 'string' ? input : input.tenantId;

    const paymentLinkMatch = processedText.match(
      /\[PAYMENT_LINK:\s*([^,]+),\s*([\d.]+)\s*\]/,
    );

    if (paymentLinkMatch) {
      try {
        const productName = paymentLinkMatch[1].trim();
        const value = parseFloat(paymentLinkMatch[2]);

        const link = await this.paymentLinkGenerator.generate({
          tenantId,
          name: productName,
          value,
        });

        processedText = processedText.replace(
          paymentLinkMatch[0],
          `Clique aqui para pagar: ${link.url}`,
        );
      } catch {
        processedText = processedText.replace(
          paymentLinkMatch[0],
          '(Link de pagamento momentaneamente indisponível, por favor aguarde)',
        );
      }
    }

    const scheduleSlotMatch = processedText.match(/\[SCHEDULE_SLOT:\s*([^\]]+)\]/);

    if (scheduleSlotMatch) {
      try {
        const action = this.parseScheduleSlotAction(scheduleSlotMatch[1]);
        const context = typeof input === 'string' ? null : input;

        if (!this.reserveProfessionalSlotUseCase) {
          throw new Error('Scheduling action handler is not configured');
        }

        if (!context?.contactId || !context.conversationId) {
          throw new Error('Missing conversation context for scheduling action');
        }

        const slot = await this.reserveProfessionalSlotUseCase.execute({
          tenantId,
          branchId: context.branchId ?? null,
          professionalId: action.professionalId,
          date: action.date,
          slotId: action.slotId,
          categoryId: action.categoryId,
          contactId: context.contactId,
          conversationId: context.conversationId,
          isFree: action.payment !== 'required',
          paymentTimeoutHours: action.payment === 'required' ? action.paymentTimeoutHours : undefined,
          suppressCustomerNotification: true,
        });

        const formattedDate = new Date(`${action.date}T12:00:00`).toLocaleDateString('pt-BR');
        const timeLine = `${slot.startsAt} as ${slot.endsAt}`;
        const categoryName = slot.reservedFor?.categoryName || slot.label || 'serviço';

        const replacement =
          slot.payment?.linkUrl
            ? `Perfeito! Deixei seu horario de ${categoryName} pre-reservado para ${formattedDate}, das ${timeLine}. Para confirmar, conclua o pagamento por aqui: ${slot.payment.linkUrl}`
            : `Perfeito! Seu agendamento de ${categoryName} ficou confirmado para ${formattedDate}, das ${timeLine}.`;

        processedText = processedText.replace(scheduleSlotMatch[0], replacement);
      } catch {
        processedText = processedText.replace(
          scheduleSlotMatch[0],
          'não consegui confirmar esse horario automaticamente agora. Vou encaminhar para um atendente finalizar com voce.',
        );
      }
    }

    return processedText;
  }

  private parseScheduleSlotAction(raw: string): {
    professionalId: string;
    date: string;
    slotId: string;
    categoryId?: string;
    payment: 'required' | 'free';
    paymentTimeoutHours?: number;
  } {
    const data = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((accumulator, part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) {
          return accumulator;
        }

        const key = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        accumulator[key] = value;
        return accumulator;
      }, {});

    if (!data.professionalId || !data.date || !data.slotId) {
      throw new Error('Invalid scheduling action payload');
    }

    return {
      professionalId: data.professionalId,
      date: data.date,
      slotId: data.slotId,
      categoryId: data.categoryId,
      payment: data.payment === 'required' ? 'required' : 'free',
      paymentTimeoutHours: data.paymentTimeoutHours
        ? Number(data.paymentTimeoutHours)
        : undefined,
    };
  }
}
