import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformAdminApiKeyGuard } from '../presentation/guards/PlatformAdminApiKeyGuard';

function mockContext(
  headers: Record<string, string | undefined>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as ExecutionContext;
}

describe('PlatformAdminApiKeyGuard', () => {
  it('PADM-T-010a: falha quando PLATFORM_ADMIN_API_KEY não está configurada', async () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const guard = new PlatformAdminApiKeyGuard(config);

    await expect(
      guard.canActivate(mockContext({ 'x-platform-admin-key': 'any' })),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      guard.canActivate(mockContext({ 'x-platform-admin-key': 'any' })),
    ).rejects.toThrow(/not configured/);
  });

  it('PADM-T-010b: falha quando header ausente ou chave incorreta', async () => {
    const config = {
      get: jest.fn().mockReturnValue('secret-expected'),
    } as unknown as ConfigService;
    const guard = new PlatformAdminApiKeyGuard(config);

    await expect(guard.canActivate(mockContext({}))).rejects.toThrow(
      UnauthorizedException,
    );

    await expect(
      guard.canActivate(mockContext({ 'x-platform-admin-key': 'wrong' })),
    ).rejects.toThrow(/Invalid platform admin credentials/);
  });

  it('PADM-T-020: aceita header correto', async () => {
    const config = {
      get: jest.fn().mockReturnValue('secret-expected'),
    } as unknown as ConfigService;
    const guard = new PlatformAdminApiKeyGuard(config);

    await expect(
      guard.canActivate(
        mockContext({ 'x-platform-admin-key': 'secret-expected' }),
      ),
    ).resolves.toBe(true);
  });
});
