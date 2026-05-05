import { ForbiddenException } from '@nestjs/common';

export function ensureAgentRuleTenantAccess(
  tenantId: string,
  requestingUserTenantId: string,
): void {
  if (tenantId !== requestingUserTenantId) {
    throw new ForbiddenException(
      'You do not have permission to access agent rules for this tenant',
    );
  }
}
