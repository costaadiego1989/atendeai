import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ISchedulingStore,
  SCHEDULING_STORE,
} from '../../domain/ports/ISchedulingStore';
import {
  MESSAGING_FACADE,
  IMessagingFacade,
} from '@modules/messaging/application/facades/MessagingFacade';

export interface JoinSchedulingMeetingInput {
  tenantId: string;
  branchId?: string;
  professionalId: string;
  slotId: string;
  date: string;
  professionalName?: string;
}

export interface JoinSchedulingMeetingOutput {
  meetingUrl: string;
  messageSent: boolean;
}

@Injectable()
export class JoinSchedulingMeetingUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly store: ISchedulingStore,
    @Inject(MESSAGING_FACADE)
    private readonly messaging: IMessagingFacade,
  ) {}

  async execute(input: JoinSchedulingMeetingInput): Promise<JoinSchedulingMeetingOutput> {
    const slot = await this.store.getAvailabilitySlot(
      input.tenantId,
      input.professionalId,
      input.date,
      input.slotId,
    );

    if (!slot) {
      throw new NotFoundException('Slot not found');
    }

    if (!slot.reservedFor?.meetingUrl) {
      throw new NotFoundException('No meeting URL available for this slot');
    }

    const meetingUrl = slot.reservedFor.meetingUrl;
    let messageSent = false;

    // Send WhatsApp notification to the client
    if (slot.reservedFor?.contactId) {
      try {
        const professionalName = input.professionalName || 'O profissional';
        const timeRange = `${slot.startsAt} – ${slot.endsAt}`;

        const text = [
          `Olá! ${professionalName} acabou de entrar na sala da sua consulta online.`,
          '',
          `Horário: ${timeRange}`,
          `Acesse agora: ${meetingUrl}`,
          '',
          'Te esperamos lá! Qualquer dúvida, é só responder aqui.',
        ].join('\n');

        await this.messaging.queueSystemMessage({
          tenantId: input.tenantId,
          contactId: slot.reservedFor.contactId,
          channel: 'WHATSAPP',
          text,
          branchId: input.branchId || null,
          conversationId: slot.reservedFor.conversationId || null,
        });

        messageSent = true;
      } catch {
        // Best-effort: don't block the professional from joining
        messageSent = false;
      }
    }

    return { meetingUrl, messageSent };
  }
}
