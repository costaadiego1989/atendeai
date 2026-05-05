import { Inject, Injectable } from '@nestjs/common';
import { PaymentService } from '@modules/payment/application/services/PaymentService';
import {
  ISchedulingStore,
  SCHEDULING_STORE,
} from '../../domain/ports/ISchedulingStore';
import { SchedulingGoogleCalendarSyncService } from '../services/SchedulingGoogleCalendarSyncService';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';

@Injectable()
export class ExpirePendingSchedulingReservationUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
    private readonly paymentService: PaymentService,
    private readonly googleCalendarSyncService: SchedulingGoogleCalendarSyncService,
    private readonly structuredLog: StructuredLogEmitter,
  ) {}

  async execute(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slotId: string;
  }) {
    const baseAttrs = {
      professional_id: input.professionalId,
      date: input.date,
      slot_id: input.slotId,
    };

    const slot = await this.schedulingStore.getAvailabilitySlot(
      input.tenantId,
      input.professionalId,
      input.date,
      input.slotId,
    );

    if (!slot) {
      this.structuredLog.emit({
        level: 'info',
        event: 'scheduling.pending_slot.auto_cancel_skip',
        message:
          'Expiration: slot does not exist, nothing to cancel (automatic cancellation ignored)',
        tenantId: input.tenantId,
        attributes: { ...baseAttrs, reason: 'no_slot' },
      });
      return null;
    }

    if (slot.status !== 'PRE_RESERVED') {
      this.structuredLog.emit({
        level: 'info',
        event: 'scheduling.pending_slot.auto_cancel_skip',
        message:
          'Slot is not in pre-reservation; automatic cancellation due to lack of payment not applicable',
        tenantId: input.tenantId,
        attributes: { ...baseAttrs, reason: 'not_pre_reserved', status: slot.status },
      });
      return null;
    }

    if (slot.payment?.status === 'PAID') {
      this.structuredLog.emit({
        level: 'info',
        event: 'scheduling.pending_slot.auto_cancel_skip',
        message: 'Pre-reservation already paid; do not release by expiration',
        tenantId: input.tenantId,
        attributes: { ...baseAttrs, reason: 'already_paid' },
      });
      return slot;
    }

    if (slot.payment?.expiresAt) {
      const expiresAt = new Date(slot.payment.expiresAt).getTime();

      if (!Number.isNaN(expiresAt) && expiresAt > Date.now()) {
        this.structuredLog.emit({
          level: 'info',
          event: 'scheduling.pending_slot.auto_cancel_skip',
          message:
            'Payment deadline not yet expired; job handled later (hold policy)',
          tenantId: input.tenantId,
          attributes: {
            ...baseAttrs,
            reason: 'before_expiry',
            expires_at: slot.payment.expiresAt,
          },
        });
        return slot;
      }
    }

    if (slot.payment?.linkId) {
      try {
        await this.paymentService.removePaymentLink(slot.payment.linkId);
      } catch {
        // Keep the expiration flow resilient even if the gateway link cleanup fails.
      }
    }

    const professional = (
      await this.schedulingStore.listProfessionals(input.tenantId)
    ).find((entry) => entry.id === input.professionalId);

    const branchId = professional?.branchId ?? null;

    const releasedSlot = await this.schedulingStore.updateSlot({
      tenantId: input.tenantId,
      professionalId: input.professionalId,
      date: input.date,
      slotId: input.slotId,
      action: 'CANCEL_RESERVATION',
    });

    if (releasedSlot) {
      await this.googleCalendarSyncService.removeReservation({
        tenantId: input.tenantId,
        branchId,
        professionalId: input.professionalId,
        date: input.date,
        slotId: input.slotId,
      });

      this.structuredLog.emit({
        level: 'info',
        event: 'scheduling.pending_slot.auto_cancelled_unpaid',
        message:
          'Pre-reservation automatically cancelled by payment expiration (slot released)',
        tenantId: input.tenantId,
        attributes: {
          ...baseAttrs,
          payment_reference: slot.payment?.reference ?? '',
          had_link_id: Boolean(slot.payment?.linkId),
        },
      });
    }

    return releasedSlot;
  }
}
