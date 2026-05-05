import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import {
  ContactTimelineEntry,
  ContactTimelineResult,
  IContactTimelineRepository,
} from '../../../application/ports/IContactTimelineRepository';

type RecoveryTimelineRow = {
  id: string;
  status: string;
  source: string;
  charge_title: string | null;
  charge_description: string | null;
  amount_due: string | number | null;
  due_date: Date | string | null;
  payment_reference: string | null;
  next_action_at: Date | string | null;
  paid_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type PaymentTimelineRow = {
  event_type: string;
  payment_id: string;
  raw_reference: string | null;
  processed_at: Date | string | null;
  created_at: Date | string;
};

type SchedulingProfessionalLookup = Record<string, { name: string; role?: string | null }>;

interface FollowUpAuditEntry {
  type: 'SCHEDULED' | 'CANCELLED' | 'TRIGGERED' | 'SKIPPED';
  conversationId: string;
  interval: string;
  reason?: string;
  timestamp: string;
}

@Injectable()
export class PrismaContactTimelineRepository implements IContactTimelineRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) { }

  async getTimeline(
    tenantId: string,
    contactId: string,
  ): Promise<ContactTimelineResult | null> {
    const contact = await this.prisma.contact.findUnique({
      where: {
        tenantId_id: {
          tenantId,
          id: contactId,
        },
      },
      include: {
        conversations: {
          include: {
            messages: true,
          },
          orderBy: {
            startedAt: 'asc',
          },
        },
      },
    });

    if (!contact) {
      return null;
    }

    const [recoveryEntries, schedulingEntries] = await Promise.all([
      this.getRecoveryEntries(tenantId, contactId),
      this.getSchedulingEntries(tenantId, contactId),
    ]);

    const entries: ContactTimelineEntry[] = [
      {
        timestamp: contact.createdAt,
        type: 'CONTACT_CREATED',
        title: 'Contato criado',
        details: {
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
        },
      },
      {
        timestamp: contact.updatedAt,
        type: 'CONTACT_STAGE',
        title: 'Estágio atual do contato',
        details: {
          stage: contact.stage,
          tags: contact.tags,
        },
      },
    ];

    if (contact.notes) {
      entries.push({
        timestamp: contact.updatedAt,
        type: 'CONTACT_NOTE',
        title: 'Observações comerciais',
        details: {
          notes: contact.notes,
        },
      });
    }

    for (const conversation of contact.conversations) {
      entries.push({
        timestamp: conversation.startedAt,
        type: 'CONVERSATION_STARTED',
        title: 'Conversa iniciada',
        details: {
          conversationId: conversation.id,
          channel: conversation.channel,
          status: conversation.status,
        },
      });

      if (conversation.status === 'PENDING_HUMAN') {
        entries.push({
          timestamp: conversation.updatedAt,
          type: 'HANDOFF_HUMAN',
          title: 'Conversa encaminhada para humano',
          details: {
            conversationId: conversation.id,
            status: conversation.status,
          },
        });
      }

      for (const message of conversation.messages) {
        const content = message.content as Record<string, unknown>;
        entries.push({
          timestamp: message.createdAt,
          type:
            message.direction === 'INBOUND'
              ? 'MESSAGE_INBOUND'
              : 'MESSAGE_OUTBOUND',
          title:
            message.direction === 'INBOUND'
              ? 'Mensagem recebida'
              : 'Mensagem enviada',
          details: {
            conversationId: conversation.id,
            channel: conversation.channel,
            sentBy: message.sentBy,
            deliveryStatus: message.deliveryStatus,
            contentType: message.contentType,
            text: content['text'] || null,
            externalId: message.externalId,
          },
        });
      }

      const followUpEntries = await this.getFollowUpEntries(conversation.id);
      entries.push(
        ...followUpEntries.map((entry) => ({
          timestamp: new Date(entry.timestamp),
          type: `FOLLOW_UP_${entry.type}` as ContactTimelineEntry['type'],
          title: this.getFollowUpTitle(entry.type),
          details: {
            conversationId: entry.conversationId,
            interval: entry.interval,
            reason: entry.reason,
          },
        })),
      );
    }

    entries.push(...recoveryEntries, ...schedulingEntries);

    entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        stage: contact.stage,
      },
      entries,
    };
  }

  private async getFollowUpEntries(
    conversationId: string,
  ): Promise<FollowUpAuditEntry[]> {
    const rawEntries = await this.redis.lrange(
      `messaging:follow-up:audit:${conversationId}`,
      0,
      99,
    );

    return rawEntries.map((entry) => JSON.parse(entry) as FollowUpAuditEntry);
  }

  private getFollowUpTitle(type: FollowUpAuditEntry['type']): string {
    switch (type) {
      case 'SCHEDULED':
        return 'Follow-up agendado';
      case 'CANCELLED':
        return 'Follow-up cancelado';
      case 'TRIGGERED':
        return 'Follow-up disparado';
      case 'SKIPPED':
        return 'Follow-up ignorado';
      default:
        return 'Evento de follow-up';
    }
  }

  private async getRecoveryEntries(
    tenantId: string,
    contactId: string,
  ): Promise<ContactTimelineEntry[]> {
    const recoveryCases = await this.prisma.$queryRaw<RecoveryTimelineRow[]>`
      SELECT
        id,
        status,
        source,
        charge_title,
        charge_description,
        amount_due,
        due_date,
        payment_reference,
        next_action_at,
        paid_at,
        created_at,
        updated_at
      FROM recovery_schema.recovery_cases
      WHERE tenant_id = ${tenantId}::uuid
        AND contact_id = ${contactId}::uuid
      ORDER BY created_at ASC
    `;

    if (!recoveryCases.length) {
      return [];
    }

    const paymentReferences = recoveryCases
      .map((recoveryCase) => recoveryCase.payment_reference)
      .filter((reference): reference is string => !!reference);

    const paymentEvents = paymentReferences.length
      ? await this.prisma.$queryRaw<PaymentTimelineRow[]>`
          SELECT
            event_type,
            payment_id,
            raw_reference,
            processed_at,
            created_at
          FROM payment_schema.payment_webhook_receipts
          WHERE tenant_id = ${tenantId}::uuid
            AND raw_reference = ANY(${paymentReferences}::text[])
            AND event_type IN ('PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED')
          ORDER BY created_at ASC
        `
      : [];

    const entries: ContactTimelineEntry[] = [];

    for (const recoveryCase of recoveryCases) {
      entries.push({
        timestamp: new Date(recoveryCase.created_at),
        type: 'RECOVERY_CASE_CREATED',
        title: 'Caso de recovery criado',
        details: {
          recoveryCaseId: recoveryCase.id,
          status: recoveryCase.status,
          source: recoveryCase.source,
          chargeTitle: recoveryCase.charge_title,
          chargeDescription: recoveryCase.charge_description,
          amountDue: recoveryCase.amount_due,
          dueDate: recoveryCase.due_date,
          paymentReference: recoveryCase.payment_reference,
        },
      });

      entries.push({
        timestamp: new Date(recoveryCase.updated_at),
        type: 'RECOVERY_STATUS',
        title: 'Status atual do recovery',
        details: {
          recoveryCaseId: recoveryCase.id,
          status: recoveryCase.status,
          nextActionAt: recoveryCase.next_action_at,
          paidAt: recoveryCase.paid_at,
          paymentReference: recoveryCase.payment_reference,
        },
      });
    }

    for (const paymentEvent of paymentEvents) {
      const normalizedType = this.mapPaymentEventType(paymentEvent.event_type);

      if (!normalizedType) {
        continue;
      }

      entries.push({
        timestamp: new Date(paymentEvent.processed_at ?? paymentEvent.created_at),
        type: normalizedType,
        title: this.getPaymentTitle(normalizedType),
        details: {
          paymentId: paymentEvent.payment_id,
          paymentReference: paymentEvent.raw_reference,
        },
      });
    }

    return entries;
  }

  private async getSchedulingEntries(
    tenantId: string,
    contactId: string,
  ): Promise<ContactTimelineEntry[]> {
    const availabilityKeys = await this.redis.keys(
      `scheduling:tenant:${tenantId}:professional:*:availability:*`,
    );

    if (!availabilityKeys.length) {
      return [];
    }

    const professionals = await this.getSchedulingProfessionals(tenantId);
    const entries: ContactTimelineEntry[] = [];

    for (const key of availabilityKeys) {
      const [professionalId, date] = this.parseSchedulingAvailabilityKey(key);
      if (!professionalId || !date) {
        continue;
      }

      const rawSlots = await this.redis.hvals(key);
      for (const rawSlot of rawSlots) {
        const slot = JSON.parse(rawSlot) as {
          id: string;
          startsAt: string;
          endsAt: string;
          status: 'AVAILABLE' | 'RESERVED';
          reservedAt?: string;
          reservedFor?: {
            contactId?: string;
            conversationId?: string;
            notes?: string;
          };
        };

        if (
          slot.status !== 'RESERVED' ||
          slot.reservedFor?.contactId !== contactId ||
          !slot.reservedAt
        ) {
          continue;
        }

        entries.push({
          timestamp: new Date(slot.reservedAt),
          type: 'SCHEDULING_RESERVED',
          title: 'horário reservado',
          details: {
            professionalId,
            professionalName:
              professionals[professionalId]?.name ?? 'Profissional',
            professionalRole:
              professionals[professionalId]?.role ?? null,
            date,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            notes: slot.reservedFor?.notes,
            conversationId: slot.reservedFor?.conversationId,
          },
        });
      }
    }

    return entries;
  }

  private async getSchedulingProfessionals(
    tenantId: string,
  ): Promise<SchedulingProfessionalLookup> {
    const records = await this.redis.hvals(
      `scheduling:tenant:${tenantId}:professionals`,
    );

    return records.reduce<SchedulingProfessionalLookup>((lookup, record) => {
      const professional = JSON.parse(record) as {
        id: string;
        name: string;
        role?: string | null;
      };
      lookup[professional.id] = {
        name: professional.name,
        role: professional.role ?? null,
      };
      return lookup;
    }, {});
  }

  private parseSchedulingAvailabilityKey(
    key: string,
  ): [professionalId: string | null, date: string | null] {
    const match =
      /^scheduling:tenant:[^:]+:professional:([^:]+):availability:(\d{4}-\d{2}-\d{2})$/.exec(
        key,
      );

    if (!match) {
      return [null, null];
    }

    return [match[1], match[2]];
  }

  private mapPaymentEventType(
    eventType: string,
  ): Extract<
    ContactTimelineEntry['type'],
    'PAYMENT_CONFIRMED' | 'PAYMENT_OVERDUE' | 'PAYMENT_REFUNDED'
  > | null {
    switch (eventType) {
      case 'PAYMENT_CONFIRMED':
        return 'PAYMENT_CONFIRMED';
      case 'PAYMENT_OVERDUE':
        return 'PAYMENT_OVERDUE';
      case 'PAYMENT_REFUNDED':
        return 'PAYMENT_REFUNDED';
      default:
        return null;
    }
  }

  private getPaymentTitle(
    type: Extract<
      ContactTimelineEntry['type'],
      'PAYMENT_CONFIRMED' | 'PAYMENT_OVERDUE' | 'PAYMENT_REFUNDED'
    >,
  ): string {
    switch (type) {
      case 'PAYMENT_CONFIRMED':
        return 'Pagamento confirmado';
      case 'PAYMENT_OVERDUE':
        return 'Pagamento em atraso';
      case 'PAYMENT_REFUNDED':
        return 'Pagamento estornado';
      default:
        return 'Evento de pagamento';
    }
  }
}
