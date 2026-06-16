import { ConnectMetaWhatsAppUseCase } from '../application/use-cases/ConnectMetaWhatsAppUseCase';
import { MetaWhatsAppEmbeddedSignupService } from '../infrastructure/services/MetaWhatsAppEmbeddedSignupService';
import { IConfigureWhatsAppUseCase } from '../application/use-cases/interfaces/IConfigureWhatsAppUseCase';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

describe('ConnectMetaWhatsAppUseCase', () => {
  let useCase: ConnectMetaWhatsAppUseCase;
  let embeddedSignup: jest.Mocked<MetaWhatsAppEmbeddedSignupService>;
  let configureWhatsApp: jest.Mocked<IConfigureWhatsAppUseCase>;

  const baseInput = {
    tenantId: 'tenant-1',
    requestingUserId: 'user-1',
    requestingUserEmail: 'owner@acme.com',
    code: 'auth-code',
    phoneNumberId: 'phone-123',
    wabaId: 'waba-456',
    businessId: 'biz-789',
    whatsappNumber: '5511999999999',
  };

  beforeEach(() => {
    embeddedSignup = {
      exchangeCodeForAccessToken: jest
        .fn()
        .mockResolvedValue({ accessToken: 'long-lived-token' }),
      subscribeAppToWaba: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MetaWhatsAppEmbeddedSignupService>;

    configureWhatsApp = {
      execute: jest.fn().mockResolvedValue({
        id: 'config-1',
        provider: 'META_CLOUD',
        whatsappNumber: '5511999999999',
        status: 'ACTIVE',
        configuredAt: new Date(),
      }),
    } as unknown as jest.Mocked<IConfigureWhatsAppUseCase>;

    useCase = new ConnectMetaWhatsAppUseCase(embeddedSignup, configureWhatsApp);
  });

  it('exchanges the code, subscribes the WABA, then persists via META_CLOUD', async () => {
    const result = await useCase.execute(baseInput);

    expect(embeddedSignup.exchangeCodeForAccessToken).toHaveBeenCalledWith(
      'auth-code',
      'tenant-1',
    );
    expect(embeddedSignup.subscribeAppToWaba).toHaveBeenCalledWith(
      'waba-456',
      'long-lived-token',
      'tenant-1',
    );
    expect(configureWhatsApp.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        provider: 'META_CLOUD',
        whatsappNumber: '5511999999999',
        metaAccessToken: 'long-lived-token',
        metaPhoneNumberId: 'phone-123',
        metaWabaId: 'waba-456',
        metaBusinessId: 'biz-789',
        metaActivate: true,
      }),
    );
    expect(result.provider).toBe('META_CLOUD');
  });

  it('subscribes the WABA before persisting credentials', async () => {
    const callOrder: string[] = [];
    embeddedSignup.subscribeAppToWaba.mockImplementation(async () => {
      callOrder.push('subscribe');
    });
    configureWhatsApp.execute.mockImplementation(async () => {
      callOrder.push('configure');
      return {
        id: 'config-1',
        provider: 'META_CLOUD',
        whatsappNumber: '5511999999999',
        status: 'ACTIVE',
        configuredAt: new Date(),
      };
    });

    await useCase.execute(baseInput);

    expect(callOrder).toEqual(['subscribe', 'configure']);
  });

  it('rejects when phoneNumberId is missing', async () => {
    await expect(
      useCase.execute({ ...baseInput, phoneNumberId: '  ' }),
    ).rejects.toThrow(ValidationErrorException);

    expect(embeddedSignup.exchangeCodeForAccessToken).not.toHaveBeenCalled();
    expect(configureWhatsApp.execute).not.toHaveBeenCalled();
  });

  it('rejects when wabaId is missing', async () => {
    await expect(
      useCase.execute({ ...baseInput, wabaId: '' }),
    ).rejects.toThrow(ValidationErrorException);

    expect(configureWhatsApp.execute).not.toHaveBeenCalled();
  });

  it('still persists credentials when WABA subscription fails (code is single-use)', async () => {
    embeddedSignup.subscribeAppToWaba.mockRejectedValue(
      new ValidationErrorException('subscribe failed'),
    );

    const result = await useCase.execute(baseInput);
    expect(configureWhatsApp.execute).toHaveBeenCalled();
    expect(result.provider).toBe('META_CLOUD');
  });
});
