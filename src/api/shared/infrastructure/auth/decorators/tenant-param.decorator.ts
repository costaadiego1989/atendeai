import { SetMetadata } from '@nestjs/common';

export const TENANT_PARAM_KEY = 'tenant_param_key';

export const TenantParam = (paramKey: string) =>
  SetMetadata(TENANT_PARAM_KEY, paramKey);
