import { SetMetadata } from '@nestjs/common';

export const REQUIRES_ACTIVE_PLAN_KEY = 'requires_active_plan';
export const RequiresActivePlan = () =>
  SetMetadata(REQUIRES_ACTIVE_PLAN_KEY, true);
