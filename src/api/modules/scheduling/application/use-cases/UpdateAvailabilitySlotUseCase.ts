import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  AvailabilitySlotRecord,
  ISchedulingStore,
  SCHEDULING_STORE,
  UpdateAvailabilitySlotInput,
} from '../../domain/ports/ISchedulingStore';
import {
  SCHEDULING_FACADE,
  type ISchedulingFacade,
} from '../facades/SchedulingFacade';
import { SchedulingGoogleCalendarSyncService } from '../services/SchedulingGoogleCalendarSyncService';

@Injectable()
export class UpdateAvailabilitySlotUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(SCHEDULING_FACADE)
    private readonly schedulingFacade: ISchedulingFacade,
    private readonly googleCalendarSyncService: SchedulingGoogleCalendarSyncService,
  ) {}

  async execute(input: UpdateAvailabilitySlotInput & { branchId?: string | null }): Promise<AvailabilitySlotRecord> {
    const contact =
      input.contactId
        ? await this.contactFacade.getContactById(input.tenantId, input.contactId)
        : null;
    const category =
      input.categoryId
        ? (await this.schedulingFacade.listCategories(input.tenantId, input.branchId)).find(
            (entry) => entry.id === input.categoryId,
          ) ?? null
        : null;

    const updatedSlot = await this.schedulingStore.updateSlot({
      ...input,
      contactName: contact?.name,
      contactPhone: contact?.phone,
      contactEmail: contact?.email,
      categoryName: category?.name,
    });

    if (!updatedSlot) {
      const slots = await this.schedulingStore.listAvailability(
        input.tenantId,
        input.professionalId,
        input.date,
      );

      const slotExists = slots.some((slot) => slot.id === input.slotId);

      if (!slotExists) {
        throw new NotFoundException('Availability slot not found');
      }

      throw new ConflictException('Availability slot could not be updated');
    }

    const professional = (
      await this.schedulingStore.listProfessionals(input.tenantId, input.branchId)
    ).find((entry) => entry.id === input.professionalId);

    if (
      input.action === 'CANCEL_RESERVATION' ||
      updatedSlot.status === 'AVAILABLE' ||
      updatedSlot.status === 'BLOCKED'
    ) {
      await this.googleCalendarSyncService.removeReservation({
        tenantId: input.tenantId,
        branchId: input.branchId ?? professional?.branchId ?? null,
        professionalId: input.professionalId,
        date: input.date,
        slotId: input.slotId,
      });
    } else {
      await this.googleCalendarSyncService.syncReservation({
        tenantId: input.tenantId,
        branchId: input.branchId ?? professional?.branchId ?? null,
        professionalId: input.professionalId,
        professionalName: professional?.name,
        date: input.date,
        slot: updatedSlot,
      });
    }

    return updatedSlot;
  }
}
