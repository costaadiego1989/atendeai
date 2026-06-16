import { MetaCloudConfigurationStrategy } from '../application/strategies/whatsapp/MetaCloudConfigurationStrategy';

describe('MetaCloudConfigurationStrategy', () => {
  let strategy: MetaCloudConfigurationStrategy;

  beforeEach(() => {
    strategy = new MetaCloudConfigurationStrategy();
  });

  const baseInput = {
    tenantId: 'tenant-1',
    whatsappNumber: '5511999999999',
    metaAccessToken: 'meta-access-token',
    metaPhoneNumberId: 'phone-123',
  };

  it('exposes META_CLOUD as its provider', () => {
    expect(strategy.provider).toBe('META_CLOUD');
  });

  it('builds a config with Meta credentials', async () => {
    const config = await strategy.configure({
      ...baseInput,
      metaWabaId: 'waba-456',
      metaBusinessId: 'biz-789',
    });

    expect(config.provider).toBe('META_CLOUD');
    expect(config.whatsappNumber).toBe('5511999999999');
    expect(config.credentials).toEqual(
      expect.objectContaining({
        accessToken: 'meta-access-token',
        phoneNumberId: 'phone-123',
        wabaId: 'waba-456',
        businessId: 'biz-789',
        status: 'PENDING_VERIFICATION',
      }),
    );
    expect(config.credentials.configuredAt).toBeTruthy();
    expect(config.status).toBe('PENDING_VERIFICATION');
  });

  it('omits optional wabaId/businessId when not provided', async () => {
    const config = await strategy.configure(baseInput);

    expect(config.credentials).toEqual(
      expect.objectContaining({
        accessToken: 'meta-access-token',
        phoneNumberId: 'phone-123',
        status: 'PENDING_VERIFICATION',
      }),
    );
    expect(config.credentials.wabaId).toBeUndefined();
    expect(config.credentials.businessId).toBeUndefined();
  });

  it('activates the config when metaActivate is true', async () => {
    const config = await strategy.configure({
      ...baseInput,
      metaActivate: true,
    });

    expect(config.status).toBe('ACTIVE');
  });

  it('throws when the access token is missing', async () => {
    await expect(
      strategy.configure({ ...baseInput, metaAccessToken: '  ' }),
    ).rejects.toThrow('Meta WhatsApp access token is required');
  });

  it('throws when the phone number id is missing', async () => {
    await expect(
      strategy.configure({ ...baseInput, metaPhoneNumberId: undefined }),
    ).rejects.toThrow('Meta WhatsApp phone number id is required');
  });
});
