import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantGuard } from '../guards/TenantGuard';
import { UnauthorizedException } from '../../../domain/exceptions/DomainExceptions';

describe('TenantGuard — Tenant Isolation', () => {
  let guard: TenantGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<Reflector>;

    guard = new TenantGuard(reflector);
  });

  function createMockContext(params: Record<string, string>, user?: any): ExecutionContext {
    const request = { params, user };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('should allow access when user tenantId matches route tenantId', () => {
    const ctx = createMockContext(
      { tenantId: 'tenant-1' },
      { tenantId: 'tenant-1', sub: 'user-1', role: 'OWNER' },
    );

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw TENANT_MISMATCH when user tenantId differs from route', () => {
    const ctx = createMockContext(
      { tenantId: 'tenant-2' },
      { tenantId: 'tenant-1', sub: 'user-1', role: 'OWNER' },
    );

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow('tenant mismatch');
  });

  it('should throw when user tries to access another tenant resources', () => {
    const ctx = createMockContext(
      { tenantId: 'tenant-attacker' },
      { tenantId: 'tenant-victim', sub: 'malicious-user', role: 'AGENT' },
    );

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw MISSING_USER when no user is attached to request', () => {
    const ctx = createMockContext({ tenantId: 'tenant-1' }, undefined);

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow('not authenticated');
  });

  it('should allow access when no tenantId param in route (non-tenant endpoint)', () => {
    const ctx = createMockContext(
      {},
      { tenantId: 'tenant-1', sub: 'user-1', role: 'OWNER' },
    );

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should use custom param key from @TenantParam decorator', () => {
    reflector.getAllAndOverride.mockReturnValue('orgId');

    const ctx = createMockContext(
      { orgId: 'tenant-1' },
      { tenantId: 'tenant-1', sub: 'user-1', role: 'OWNER' },
    );

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should reject when custom param key does not match user tenant', () => {
    reflector.getAllAndOverride.mockReturnValue('orgId');

    const ctx = createMockContext(
      { orgId: 'tenant-other' },
      { tenantId: 'tenant-1', sub: 'user-1', role: 'OWNER' },
    );

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should prevent horizontal privilege escalation between tenants', () => {
    const tenants = ['tenant-a', 'tenant-b', 'tenant-c'];

    for (const attackerTenant of tenants) {
      for (const targetTenant of tenants) {
        if (attackerTenant === targetTenant) continue;

        const ctx = createMockContext(
          { tenantId: targetTenant },
          { tenantId: attackerTenant, sub: 'user-x', role: 'OWNER' },
        );

        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
      }
    }
  });
});
