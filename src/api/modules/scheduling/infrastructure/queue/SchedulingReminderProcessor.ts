import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  IMessagingFacade,
  MESSAGING_FACADE,
} from '@modules/messaging/application/facades/MessagingFacade';
import {
  ISchedulingStore,
  SCHEDULING_STORE,
} from '../../domain/ports/ISchedulingStore';
import { SchedulingReminderQueueJob } from '../../domain/ports/ISchedulingReminderQueue';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';

@Processor('scheduling-reminders')
export class SchedulingReminderProcessor extends WorkerHost {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
    private readonly structuredLog: StructuredLogEmitter,
  ) {
    super();
  }

  async process(job: Job<SchedulingReminderQueueJob>): Promise<void> {
    if (job.name !== 'send-scheduling-reminder') {
      return;
    }

    const data = job.data;
    const correlationId =
      typeof job.id === 'string'
        ? job.id
        : job.id !== undefined && job.id !== null
          ? String(job.id)
          : '';

    const slot = await this.schedulingStore.getAvailabilitySlot(
      data.tenantId,
      data.professionalId,
      data.date,
      data.slotId,
    );

    if (!slot?.reservedFor?.contactId || slot.status !== 'RESERVED') {
      this.structuredLog.emit({
        level: 'warn',
        event: 'scheduling.reminder.skipped_slot_inactive',
        message:
          'Lembrete Bull não enviado: slot sem reserva ativa RESERVED ou sem contacto',
        tenantId: data.tenantId,
        attributes: {
          bull_job_id: correlationId,
          reminder_offset_hours: String(data.offsetHours),
          slot_id: data.slotId,
          professional_id: data.professionalId,
          date: data.date,
          slot_status: slot?.status ?? 'n/a',
        },
      });
      return;
    }

    const professional = (
      await this.schedulingStore.listProfessionals(data.tenantId, data.branchId)
    ).find((entry) => entry.id === data.professionalId);

    await this.messagingFacade.queueSystemMessage({
      tenantId: data.tenantId,
      contactId: slot.reservedFor.contactId,
      channel: 'WHATSAPP',
      branchId: data.branchId ?? null,
      text: this.buildReminderMessage({
        offsetHours: data.offsetHours,
        date: data.date,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        professionalName: professional?.name,
        categoryName: slot.reservedFor.categoryName,
        meetingUrl: slot.reservedFor.meetingUrl,
      }),
    });

    this.structuredLog.emit({
      level: 'info',
      event: 'scheduling.reminder.outbound_queued',
      message: 'Lembrete de agendamento enviado à fila de mensagens',
      tenantId: data.tenantId,
      attributes: {
        bull_job_id: correlationId,
        appointment_slot_id: data.slotId,
        contact_id: slot.reservedFor.contactId,
        professional_id: data.professionalId,
        date: data.date,
        offset_hours: String(data.offsetHours),
      },
    });
  }

  private buildReminderMessage(input: {
    offsetHours: 24 | 3 | 1;
    date: string;
    startsAt: string;
    endsAt: string;
    professionalName?: string;
    categoryName?: string;
    meetingUrl?: string;
  }): string {
    const formattedDate = new Date(`${input.date}T12:00:00`).toLocaleDateString(
      'pt-BR',
    );
    const offsetLabel =
      input.offsetHours === 24
        ? 'Amanhã'
        : `daqui há ${input.offsetHours} hora${input.offsetHours > 1 ? 's' : ''}`;
    const categoryLine = input.categoryName ? ` de ${input.categoryName}` : '';
    const professionalLine = input.professionalName
      ? ` com ${input.professionalName}`
      : '';
    const meetLine = input.meetingUrl
      ? `\n\nLink do Google Meet: ${input.meetingUrl}`
      : '';

    return `Lembrete: seu agendamento${categoryLine}${professionalLine} e ${offsetLabel}, ${formattedDate}, das ${input.startsAt} às ${input.endsAt}.${meetLine}`;
  }
}
