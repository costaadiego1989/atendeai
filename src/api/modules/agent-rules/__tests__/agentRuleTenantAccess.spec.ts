import { ForbiddenException } from '@nestjs/common';
import { ensureAgentRuleTenantAccess } from '../application/support/agentRuleTenantAccess';

describe('ensureAgentRuleTenantAccess', () => {
  it('AGENT-U-010: permite acesso quando IDs coincidem', () => {
    expect(() =>
      ensureAgentRuleTenantAccess('tenant-1', 'tenant-1'),
    ).not.toThrow();
  });

  it('AGENT-U-011: lança ForbiddenException quando IDs diferem', () => {
    expect(() =>
      ensureAgentRuleTenantAccess('tenant-1', 'tenant-2'),
    ).toThrow(ForbiddenException);
  });

  it('AGENT-U-012: lança com strings vazias', () => {
    expect(() => ensureAgentRuleTenantAccess('', 'tenant-1')).toThrow(
      ForbiddenException,
    );
    expect(() => ensureAgentRuleTenantAccess('tenant-1', '')).toThrow(
      ForbiddenException,
    );
    expect(() => ensureAgentRuleTenantAccess('', '')).not.toThrow();
  });
});
