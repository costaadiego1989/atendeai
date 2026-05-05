import { ExpirePendingSchedulingReservationUseCase } from '../application/use-cases/ExpirePendingSchedulingReservationUseCase';

describe('ExpirePendingSchedulingReservationUseCase', () => {
  const tenantId = 'tenant-1';
  const professionalId = 'professional-1';
  const date = '2031-06-01';
  const slotId = 'slot-1';

  it('cancela pré-reserva expirada, remove agenda e loga cancelamento automático', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const slot = {
      id: slotId,
      startsAt: '10:00',
      endsAt: '11:00',
      status: 'PRE_RESERVED' as const,
      reservedFor: { contactId: 'c1' },
      payment: {
        reference: 'scheduling|tenant-1|professional-1|2031-06-01|slot-1',
        linkId: 'link-1',
        linkUrl: 'https://pay.example/x',
        amount: 100,
        billingType: 'PIX' as const,
        status: 'PENDING' as const,
        expiresAt: past,
      },
    };

    const schedulingStore = {
      getAvailabilitySlot: jest.fn().mockResolvedValue(slot),
      updateSlot: jest.fn().mockResolvedValue({ ...slot, status: 'AVAILABLE' }),
      listProfessionals: jest.fn().mockResolvedValue([
        { id: professionalId, branchId: 'branch-1' },
      ]),
    };

    const paymentService = {
      removePaymentLink: jest.fn().mockResolvedValue(undefined),
    };

    const googleCalendarSyncService = {
      removeReservation: jest.fn().mockResolvedValue(undefined),
    };

    const structuredLog = { emit: jest.fn() };

    const useCase = new ExpirePendingSchedulingReservationUseCase(
      schedulingStore as any,
      paymentService as any,
      googleCalendarSyncService as any,
      structuredLog as any,
    );

    await useCase.execute({ tenantId, professionalId, date, slotId });

    expect(paymentService.removePaymentLink).toHaveBeenCalledWith('link-1');
    expect(schedulingStore.updateSlot).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CANCEL_RESERVATION' }),
    );
    expect(googleCalendarSyncService.removeReservation).toHaveBeenCalledWith({
      tenantId,
      branchId: 'branch-1',
      professionalId,
      date,
      slotId,
    });

    expect(structuredLog.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'scheduling.pending_slot.auto_cancelled_unpaid',
      }),
    );
  });

  it('não cancela quando o prazo expiresAt é futuro', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const slot = {
      id: slotId,
      startsAt: '10:00',
      endsAt: '11:00',
      status: 'PRE_RESERVED' as const,
      payment: {
        expiresAt: future,
        status: 'PENDING' as const,
        linkId: 'link-x',
      },
    };

    const schedulingStore = {
      getAvailabilitySlot: jest.fn().mockResolvedValue(slot),
      updateSlot: jest.fn(),
      listProfessionals: jest.fn(),
    };

    const structuredLog = { emit: jest.fn() };

    const useCase = new ExpirePendingSchedulingReservationUseCase(
      schedulingStore as any,
      {} as any,
      { removeReservation: jest.fn() } as any,
      structuredLog as any,
    );

    await useCase.execute({ tenantId, professionalId, date, slotId });

    expect(schedulingStore.updateSlot).not.toHaveBeenCalled();
    expect(structuredLog.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'scheduling.pending_slot.auto_cancel_skip',
        attributes: expect.objectContaining({ reason: 'before_expiry' }),
      }),
    );
  });
});
