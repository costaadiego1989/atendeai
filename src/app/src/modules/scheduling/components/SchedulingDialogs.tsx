import type { SchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { SchedulingAssignCategoriesSheet } from './SchedulingAssignCategoriesSheet';
import { SchedulingBulkSlotGeneratorSheet } from './SchedulingBulkSlotGeneratorSheet';
import { SchedulingCreateCategorySheet } from './SchedulingCreateCategorySheet';
import { SchedulingCreateProfessionalSheet } from './SchedulingCreateProfessionalSheet';
import { SchedulingReportsSheet } from './SchedulingReportsSheet';
import { SchedulingReserveSlotSheet } from './SchedulingReserveSlotSheet';
import { SchedulingRescheduleReservationSheet } from './SchedulingRescheduleReservationSheet';
import { SchedulingSlotDetailsSheet } from './SchedulingSlotDetailsSheet';

type Props = {
  vm: SchedulingPageViewModel;
};

export function SchedulingDialogs({ vm }: Props) {
  return (
    <>
      <SchedulingCreateProfessionalSheet vm={vm} />
      <SchedulingCreateCategorySheet vm={vm} />
      <SchedulingAssignCategoriesSheet vm={vm} />
      <SchedulingBulkSlotGeneratorSheet vm={vm} />
      <SchedulingReserveSlotSheet vm={vm} />
      <SchedulingSlotDetailsSheet vm={vm} />
      <SchedulingRescheduleReservationSheet vm={vm} />
      <SchedulingReportsSheet vm={vm} />
    </>
  );
}
