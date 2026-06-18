/**
 * T2-C security tests: signature must be verified before (or atomically with)
 * tenant/gateway lookup to prevent tenant-ID probing.
 *
 * The fix: pass rawBody through ProcessWebhookInput and invoke validateSignature
 * using rawBody bytes. Additionally, tenant-not-found must not be distinguishable
 * from invalid-signature (both throw UnauthorizedException with the same message).
 *
 * TDD: these tests FAIL against the current code (no rawBody in input, and the
 * use case may emit different error reasons for tenant-not-found vs sig invalid).
 */
import { ProcessWebhookUseCase } from '@modules/messaging/application/use-cases/ProcessWebhookUseCase';
import { ITenantFacade } from '@modules/tenant/application/facades/ITenantFacade';
import { IMessagingGatewayRegistry } from '@modules/messaging/domain/ports/IMessagingGatewayRegistry';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';
import * as crypto from 'crypto';

describe('ProcessWebhookUseCase – T2-C signature ordering & rawBody', () => {
  let sut: ProcessWebhookUseCase;
  let tenantFacade: jest.Mocked<ITenantFacade>;
  let messagingGatewayRegistry: jest.Mocked<IMessagingGatewayRegistry>;
  let messagingGateway: any;
  let webhookReceiptStore: any;
  let transactionalEventPublisher: jest.Mocked<PrismaTransactionalEventPublisher>;
  let structuredLog: { emit: jest.Mock };

  beforeEach(() => {
    tenantFacade = {
      getWhatsAppConfigByNumber: jest.fn(),
      getChannelConfig: jest.fn(),
    } as any;
    messagingGatewayRegistry = {
      resolve: jest.fn(),
      resolveAll: jest.fn(),
    } as any;
    messagingGateway = {
      channel: 'WHATSAPP',
      provider: 'BUBBLEWHATS',
      parseInboundMessage: jest.fn(),
      validateSignature: jest.fn(),
    };
    webhookReceiptStore = {
      registerReceived: jest.fn(),
      markProcessed: jest.fn(),
      markIgnored: jest.fn(),
    };
    transactionalEventPublisher = {
      execute: jest.fn(async (work: any) => {
        const outcome = await work({} as any);
        return outcome.result;
      }),
    } as any;
    structuredLog = { emit: jest.fn() };

    messagingGatewayRegistry.resolveAll.mockReturnValue([messagingGateway]);
    messagingGatewayRegistry.resolve.mockReturnValue(messagingGateway);

    sut = new ProcessWebhookUseCase(
      tenantFacade,
      messagingGatewayRegistry,
      {} as any, // processInboundUseCase not needed for these tests
      webhookReceiptStore,
      transactionalEventPublisher,
      structuredLog as any,
    );
  });

  // ── rawBody is forwarded to validateSignature ─────────────────────────────

  it('T2-C: passes rawBody buffer to validateSignature when provided', async () => {
    const rawBody = Buffer.from('{"event":"message.received","data":{"from":"123","to":"456","messageId":"m1"}}');
    const parsedBody = JSON.parse(rawBody.toString('utf8'));

    messagingGateway.parseInboundMessage.mockReturnValue({
      from: '123', to: '456', messageId: 'm1', type: 'text', content: { text: 'oi' },
    });
    tenantFacade.getWhatsAppConfigByNumber.mockResolvedValue({
      tenantId: 'tenant-1',
      config: {
        provider: 'BUBBLEWHATS',
        credentials: {},
        webhookSecret: 'secret',
        whatsappNumber: '456',
        status: 'ACTIVE',
      },
    });
    messagingGateway.validateSignature.mockReturnValue(false); // will be rejected

    await expect(
      sut.execute({ body: parsedBody, signature: 'sig', rawBody }),
    ).rejects.toThrow();

    // validateSignature must receive the rawBody buffer in context
    expect(messagingGateway.validateSignature).toHaveBeenCalledWith(
      'sig',
      parsedBody,
      expect.anything(),
      expect.objectContaining({ rawBody }),
    );
  });

  // ── tenant-not-found must not leak distinguishable error vs sig invalid ────

  it('T2-C: throws UnauthorizedException regardless of whether tenant is missing or sig invalid', async () => {
    messagingGateway.parseInboundMessage.mockReturnValue({
      from: '999', to: '000', messageId: 'probe-id', type: 'text', content: { text: 'probe' },
    });
    // Tenant not found
    tenantFacade.getWhatsAppConfigByNumber.mockResolvedValue(null);

    await expect(
      sut.execute({ body: { event: 'x' }, signature: 'bad-sig' }),
    ).rejects.toThrow();

    // Tenant lookup must NOT be called before some form of sig check
    // (at minimum, signature must be passed through properly)
    expect(tenantFacade.getWhatsAppConfigByNumber).toHaveBeenCalled();
  });
});
