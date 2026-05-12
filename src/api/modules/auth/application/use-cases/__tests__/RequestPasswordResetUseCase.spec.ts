import { RequestPasswordResetUseCase } from '../RequestPasswordResetUseCase';
import { AuthUser } from '../../../domain/entities/AuthUser';
import { AuthUserEmail } from '../../../domain/value-objects/AuthUserEmail';
import { Role } from '@shared/domain/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('RequestPasswordResetUseCase', () => {
  let useCase: RequestPasswordResetUseCase;
  let authUserRepository: any;
  let passwordResetTokenStore: any;
  let passwordResetEmailSender: any;
  let authAuditLogRepository: any;
  let configService: any;

  function createMockUser(overrides: Partial<{ id: string; email: string; name: string; tenantId: string }> = {}) {
    return AuthUser.create(
      {
        tenantId: overrides.tenantId ?? 'tenant-1',
        email: AuthUserEmail.create(overrides.email ?? 'user@test.com'),
        name: overrides.name ?? 'Test User',
        passwordHash: 'hashed',
        role: Role.create('OWNER'),
        tenantCreatedAt: new Date('2025-01-01'),
      },
      new UniqueEntityID(overrides.id ?? 'user-1'),
    );
  }

  beforeEach(() => {
    authUserRepository = { findByEmail: jest.fn() };
    passwordResetTokenStore = {
      create: jest.fn().mockResolvedValue(undefined),
      invalidateForUser: jest.fn().mockResolvedValue(undefined),
    };
    passwordResetEmailSender = { send: jest.fn().mockResolvedValue(undefined) };
    authAuditLogRepository = { record: jest.fn().mockResolvedValue(undefined) };
    configService = {
      get: jest.fn().mockReturnValue('https://app.atendeai.com/reset-password'),
    };

    useCase = new RequestPasswordResetUseCase(
      authUserRepository,
      passwordResetTokenStore,
      passwordResetEmailSender,
      authAuditLogRepository,
      configService,
    );
  });

  it('should generate token and send email when user exists', async () => {
    const mockUser = createMockUser({ email: 'user@test.com', name: 'Test User' });
    authUserRepository.findByEmail.mockResolvedValue(mockUser);

    const result = await useCase.execute({ email: 'user@test.com' });

    expect(result.message).toBeDefined();
    expect(passwordResetTokenStore.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        email: 'user@test.com',
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    );
    expect(passwordResetEmailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@test.com',
        name: 'Test User',
        resetUrl: expect.stringContaining('https://app.atendeai.com/reset-password?token='),
        expiresAt: expect.any(Date),
      }),
    );
  });

  it('should return success message even when email does not exist (anti-enumeration)', async () => {
    authUserRepository.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute({ email: 'nonexistent@test.com' });

    expect(result.message).toBeDefined();
    expect(passwordResetTokenStore.create).not.toHaveBeenCalled();
    expect(passwordResetEmailSender.send).not.toHaveBeenCalled();
  });

  it('should generate token with expiration (1 hour)', async () => {
    const mockUser = createMockUser();
    authUserRepository.findByEmail.mockResolvedValue(mockUser);

    const before = Date.now();
    await useCase.execute({ email: 'user@test.com' });
    const after = Date.now();

    const createCall = passwordResetTokenStore.create.mock.calls[0][0];
    const expiresAt = createCall.expiresAt.getTime();
    // Should expire approximately 1 hour from now
    expect(expiresAt).toBeGreaterThanOrEqual(before + 59 * 60 * 1000);
    expect(expiresAt).toBeLessThanOrEqual(after + 61 * 60 * 1000);
  });

  it('should invalidate previous tokens before creating new one', async () => {
    const mockUser = createMockUser();
    authUserRepository.findByEmail.mockResolvedValue(mockUser);

    await useCase.execute({ email: 'user@test.com' });

    expect(passwordResetTokenStore.invalidateForUser).toHaveBeenCalledWith('user-1');
    // invalidateForUser should be called before create
    const invalidateOrder = passwordResetTokenStore.invalidateForUser.mock.invocationCallOrder[0];
    const createOrder = passwordResetTokenStore.create.mock.invocationCallOrder[0];
    expect(invalidateOrder).toBeLessThan(createOrder);
  });

  it('should call emailSender with correct reset link', async () => {
    const mockUser = createMockUser();
    authUserRepository.findByEmail.mockResolvedValue(mockUser);

    await useCase.execute({ email: 'user@test.com' });

    const sendCall = passwordResetEmailSender.send.mock.calls[0][0];
    expect(sendCall.resetUrl).toMatch(
      /^https:\/\/app\.atendeai\.com\/reset-password\?token=[a-f0-9]{64}$/,
    );
  });

  it('should register audit PASSWORD_RESET_REQUESTED', async () => {
    const mockUser = createMockUser();
    authUserRepository.findByEmail.mockResolvedValue(mockUser);

    await useCase.execute({
      email: 'user@test.com',
      context: { ipAddress: '10.0.0.1', userAgent: 'Chrome', deviceId: 'dev-1' },
    });

    expect(authAuditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PASSWORD_RESET_REQUESTED',
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'user@test.com',
        ipAddress: '10.0.0.1',
        metadata: expect.objectContaining({ resolvedUser: true }),
      }),
    );
  });

  it('should work with fallback URL when config is not set', async () => {
    configService.get.mockReturnValue(undefined);
    const mockUser = createMockUser();
    authUserRepository.findByEmail.mockResolvedValue(mockUser);

    await useCase.execute({ email: 'user@test.com' });

    const sendCall = passwordResetEmailSender.send.mock.calls[0][0];
    expect(sendCall.resetUrl).toContain('http://localhost:8080/reset-password?token=');
  });
});
