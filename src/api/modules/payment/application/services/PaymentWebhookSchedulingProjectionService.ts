import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { parseSchedulingPaymentReference } from '@modules/scheduling/application/services/SchedulingPaymentReference';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';

export interface PaymentWebhookProjectionInput {
  eventType: string;
  tenantId?: string;
  rawReference?: string;
  occurredAt: Date;
}

@Injectable()
export class PaymentWebhookSchedulingProjectionService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async project(input: PaymentWebhookProjectionInput): Promise<void> {
    if (
      input.eventType !== 'PAYMENT_CONFIRMED' ||
      !input.tenantId ||
      !input.rawReference
    ) {
      return;
    }

    const parsedReference = parseSchedulingPaymentReference(input.rawReference);
    if (!parsedReference || parsedReference.tenantId !== input.tenantId) {
      return;
    }

    const availabilityKeys = await this.redis.keys(
      `scheduling:tenant:${input.tenantId}:professional:*:availability:*`,
    );

    for (const key of availabilityKeys) {
      const rawSlots = await this.redis.hgetall(key);

      for (const [slotId, rawSlot] of Object.entries(rawSlots)) {
        const slot = JSON.parse(rawSlot) as {
          payment?: {
            reference?: string;
          };
        };

        if (slot.payment?.reference !== input.rawReference) {
          continue;
        }

        const currentSlot = JSON.parse(rawSlot) as Record<string, unknown> & {
          status?: string;
          payment?: Record<string, unknown>;
        };
        const nextSlot = {
          ...currentSlot,
          status:
            currentSlot.status === 'PRE_RESERVED'
              ? 'RESERVED'
              : currentSlot.status,
          payment: {
            ...(currentSlot.payment ?? {}),
            status: 'PAID',
            confirmedAt: input.occurredAt.toISOString(),
          },
        };

        await this.redis.hset(key, slotId, JSON.stringify(nextSlot));
        return;
      }
    }
  }
}
