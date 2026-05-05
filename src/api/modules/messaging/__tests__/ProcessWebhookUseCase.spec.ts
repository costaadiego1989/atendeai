import { ProcessWebhookUseCase } from '@modules/messaging/application/use-cases/ProcessWebhookUseCase';
import { ITenantFacade } from '@modules/tenant/application/facades/ITenantFacade';
import { IMessagingGatewayRegistry } from '@modules/messaging/domain/ports/IMessagingGatewayRegistry';
import { ProcessInboundMessageUseCase } from '@modules/messaging/application/use-cases/ProcessInboundMessageUseCase';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';
import { MessageReceivedIntegrationEvent } from '@modules/messaging/application/integration-events/publishers/MessageReceivedIntegrationEvent';

describe('ProcessWebhookUseCase', () => {
    let sut: ProcessWebhookUseCase;
    let tenantFacade: jest.Mocked<ITenantFacade>;
    let messagingGatewayRegistry: jest.Mocked<IMessagingGatewayRegistry>;
    let messagingGateway: any;
    let processInboundUseCase: jest.Mocked<ProcessInboundMessageUseCase>;
    let webhookReceiptStore: any;
    let transactionalEventPublisher: jest.Mocked<PrismaTransactionalEventPublisher>;
    let structuredLog: { emit: jest.Mock };

    beforeEach(() => {
        tenantFacade = {
            getChannelConfig: jest.fn(),
            getWhatsAppConfigByNumber: jest.fn(),
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
        processInboundUseCase = {
            execute: jest.fn(),
            persistInboundMessage: jest.fn(),
        } as any;
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
        messagingGatewayRegistry.resolve.mockReturnValue(messagingGateway);
        messagingGatewayRegistry.resolveAll.mockReturnValue([messagingGateway]);
        sut = new ProcessWebhookUseCase(
            tenantFacade,
            messagingGatewayRegistry,
            processInboundUseCase,
            webhookReceiptStore,
            transactionalEventPublisher,
            structuredLog as any,
        );
    });

    it('should process a valid webhook successfully', async () => {
        const body = { event: 'message.received', data: { from: '123', to: '456', messageId: 'msg-1' } };
        const signature = 'valid-sig';

        messagingGateway.parseInboundMessage.mockReturnValue({
            from: '123',
            to: '456',
            messageId: 'msg-1',
            type: 'text',
            content: { text: 'oi' }
        });

        tenantFacade.getWhatsAppConfigByNumber.mockResolvedValue({
            tenantId: 'tenant-1',
            config: {
                whatsappNumber: '456',
                provider: 'BUBBLEWHATS',
                credentials: {
                    id: '7071',
                    token: 'tenant-token',
                    apiUrl: 'https://7071.bubblewhats.com',
                },
                webhookSecret: 'secret',
                status: 'ACTIVE'
            }
        });

        messagingGateway.validateSignature.mockReturnValue(true);
        webhookReceiptStore.registerReceived.mockResolvedValue({
            id: 'receipt-1',
            isNew: true,
        });
        processInboundUseCase.persistInboundMessage.mockResolvedValue([
            new MessageReceivedIntegrationEvent({
                tenantId: 'tenant-1',
                conversationId: 'conversation-1',
                contactId: 'contact-1',
                messageId: 'message-1',
                content: { type: 'TEXT', text: 'oi' },
                channel: 'WHATSAPP',
            }, 'messaging:inbound:msg-1'),
        ]);

        const result = await sut.execute({ body, signature });

        expect(result.status).toBe('received');
        expect(webhookReceiptStore.registerReceived).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: 'BUBBLEWHATS',
                externalMessageId: 'msg-1',
            }),
            expect.any(Object),
        );
        expect(processInboundUseCase.persistInboundMessage).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-1',
            fromPhone: '123',
        }), expect.objectContaining({ tx: expect.any(Object) }));
        expect(webhookReceiptStore.markProcessed).toHaveBeenCalledWith(
            'receipt-1',
            expect.any(Object),
        );
    });

    it('should resolve tenant by bubbleWhats device id when destination number is missing', async () => {
        const body = {
            deviceID: '7071',
            messages: [
                {
                    key: {
                        remoteJid: '5511999997777@s.whatsapp.net',
                        id: 'native-msg-1',
                        fromMe: false,
                    },
                    message: {
                        conversation: 'oi nativo',
                    },
                    messageTimestamp: 1710000000,
                },
            ],
        };

        messagingGateway.parseInboundMessage.mockReturnValue({
            messageId: 'native-msg-1',
            from: '5511999997777',
            deviceId: '7071',
            type: 'text',
            content: { text: 'oi nativo' },
        });
        tenantFacade.getWhatsAppConfigByNumber.mockResolvedValue({
            tenantId: 'tenant-1',
            config: {
                provider: 'BUBBLEWHATS',
                credentials: {
                    id: '7071',
                },
                whatsappNumber: '5521993001883',
                status: 'ACTIVE',
            },
        } as any);
        messagingGateway.validateSignature.mockReturnValue(true);
        webhookReceiptStore.registerReceived.mockResolvedValue({
            id: 'receipt-2',
            isNew: true,
        });
        processInboundUseCase.persistInboundMessage.mockResolvedValue([
            new MessageReceivedIntegrationEvent({
                tenantId: 'tenant-1',
                conversationId: 'conversation-1',
                contactId: 'contact-1',
                messageId: 'message-1',
                content: { type: 'TEXT', text: 'oi nativo' },
                channel: 'WHATSAPP',
            }, 'messaging:inbound:native-msg-1'),
        ]);

        const result = await sut.execute({ body, signature: '' });

        expect(result).toEqual({ status: 'received' });
        expect(tenantFacade.getWhatsAppConfigByNumber).toHaveBeenCalledWith(
            undefined,
            '7071',
        );
        expect(processInboundUseCase.persistInboundMessage).toHaveBeenCalledWith({
            tenantId: 'tenant-1',
            branchId: null,
            externalMessageId: 'native-msg-1',
            fromPhone: '5511999997777',
            toPhone: '5521993001883',
            contentType: 'text',
            content: { text: 'oi nativo' },
            channel: 'WHATSAPP',
        }, expect.objectContaining({ tx: expect.any(Object) }));
        expect(webhookReceiptStore.markProcessed).toHaveBeenCalledWith(
            'receipt-2',
            expect.any(Object),
        );
    });

    it('should return ignored if message cannot be parsed', async () => {
        messagingGateway.parseInboundMessage.mockReturnValue(null);
        const result = await sut.execute({ body: {}, signature: '' });
        expect(result.status).toBe('ignored');
        expect(webhookReceiptStore.registerReceived).not.toHaveBeenCalled();
        expect(processInboundUseCase.persistInboundMessage).not.toHaveBeenCalled();
    });

    it('should parse 360dialog webhook payloads when D360 adapter matches first valid payload', async () => {
        const d360Gateway = {
            channel: 'WHATSAPP',
            provider: 'D360',
            parseInboundMessage: jest.fn().mockReturnValue({
                from: '5511999998888',
                to: '5511988887777',
                deviceId: '1234567890',
                messageId: 'wamid-1',
                type: 'text',
                content: { text: 'oi cloud api' },
            }),
            validateSignature: jest.fn().mockReturnValue(true),
        };
        messagingGatewayRegistry.resolveAll.mockReturnValue([messagingGateway, d360Gateway] as any);
        messagingGateway.parseInboundMessage.mockReturnValue(null);
        messagingGatewayRegistry.resolve.mockImplementation((channel, provider) => {
            if (provider === 'D360') {
                return d360Gateway as any;
            }
            return messagingGateway as any;
        });
        tenantFacade.getWhatsAppConfigByNumber.mockResolvedValue({
            tenantId: 'tenant-1',
            branchId: 'branch-1',
            config: {
                provider: 'D360',
                credentials: { apiKey: 'd360-key' },
                webhookSecret: null,
                whatsappNumber: '5511988887777',
                status: 'ACTIVE',
                branchId: 'branch-1',
            },
        } as any);
        webhookReceiptStore.registerReceived.mockResolvedValue({
            id: 'receipt-d360',
            isNew: true,
        });
        processInboundUseCase.persistInboundMessage.mockResolvedValue([
            new MessageReceivedIntegrationEvent({
                tenantId: 'tenant-1',
                conversationId: 'conversation-1',
                contactId: 'contact-1',
                messageId: 'message-1',
                content: { type: 'TEXT', text: 'oi cloud api' },
                channel: 'WHATSAPP',
            }, 'messaging:inbound:wamid-1'),
        ]);

        const result = await sut.execute({ body: {}, signature: '' });

        expect(result).toEqual({ status: 'received' });
        expect(tenantFacade.getWhatsAppConfigByNumber).toHaveBeenCalledWith(
            '5511988887777',
            '1234567890',
        );
        expect(processInboundUseCase.persistInboundMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                branchId: 'branch-1',
            }),
            expect.objectContaining({ tx: expect.any(Object) }),
        );
        expect(d360Gateway.validateSignature).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when tenant is not found for the destination number', async () => {
        messagingGateway.parseInboundMessage.mockReturnValue({
            to: '456',
        });
        tenantFacade.getWhatsAppConfigByNumber.mockResolvedValue(null);

        await expect(
            sut.execute({ body: {}, signature: 'valid' }),
        ).rejects.toThrow('Tenant not found for this number');

        expect(messagingGateway.validateSignature).not.toHaveBeenCalled();
        expect(processInboundUseCase.persistInboundMessage).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when whatsapp config is inactive', async () => {
        messagingGateway.parseInboundMessage.mockReturnValue({
            to: '456',
        });
        tenantFacade.getWhatsAppConfigByNumber.mockResolvedValue({
            tenantId: 'tenant-1',
            config: {
                provider: 'BUBBLEWHATS',
                credentials: {},
                status: 'PENDING_VERIFICATION',
                webhookSecret: 'secret',
            },
        } as any);

        await expect(
            sut.execute({ body: {}, signature: 'valid' }),
        ).rejects.toThrow('WhatsApp not configured or inactive');

        expect(messagingGateway.validateSignature).not.toHaveBeenCalled();
        expect(processInboundUseCase.persistInboundMessage).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if signature is invalid', async () => {
        messagingGateway.parseInboundMessage.mockReturnValue({ to: '456' });
        tenantFacade.getWhatsAppConfigByNumber.mockResolvedValue({
            tenantId: 'tenant-1',
            config: {
                provider: 'BUBBLEWHATS',
                credentials: {},
                status: 'ACTIVE',
                webhookSecret: 'secret',
            }
        } as any);
        messagingGateway.validateSignature.mockReturnValue(false);

        await expect(sut.execute({ body: {}, signature: 'invalid' }))
            .rejects.toThrow('Invalid signature');
    });

    it('should ignore duplicated validated webhook receipts', async () => {
        messagingGateway.parseInboundMessage.mockReturnValue({
            from: '123',
            to: '456',
            messageId: 'msg-duplicate',
            type: 'text',
            content: { text: 'oi' }
        });
        tenantFacade.getWhatsAppConfigByNumber.mockResolvedValue({
            tenantId: 'tenant-1',
            config: {
                provider: 'BUBBLEWHATS',
                credentials: {},
                webhookSecret: 'secret',
                whatsappNumber: '456',
                status: 'ACTIVE'
            }
        } as any);
        messagingGateway.validateSignature.mockReturnValue(true);
        webhookReceiptStore.registerReceived.mockResolvedValue({
            id: 'receipt-duplicate',
            isNew: false,
        });

        const result = await sut.execute({ body: {}, signature: 'valid' });

        expect(result).toEqual({ status: 'ignored' });
        expect(processInboundUseCase.persistInboundMessage).not.toHaveBeenCalled();
        expect(webhookReceiptStore.markProcessed).not.toHaveBeenCalled();
    });

    it('should validate signature with tenant secret and dispatch inbound processing payload', async () => {
        const body = { event: 'message.received' };
        messagingGateway.parseInboundMessage.mockReturnValue({
            from: '123',
            to: '456',
            messageId: 'msg-10',
            type: 'image',
            content: { text: 'imagem recebida' }
        });
        tenantFacade.getWhatsAppConfigByNumber.mockResolvedValue({
            tenantId: 'tenant-1',
            config: {
                provider: 'BUBBLEWHATS',
                credentials: {
                    id: '7071',
                    token: 'tenant-token',
                    apiUrl: 'https://7071.bubblewhats.com',
                },
                status: 'ACTIVE',
                webhookSecret: 'secret',
                whatsappNumber: '456',
            },
        } as any);
        messagingGateway.validateSignature.mockReturnValue(true);
        webhookReceiptStore.registerReceived.mockResolvedValue({
            id: 'receipt-3',
            isNew: true,
        });
        processInboundUseCase.persistInboundMessage.mockResolvedValue([
            new MessageReceivedIntegrationEvent({
                tenantId: 'tenant-1',
                conversationId: 'conversation-1',
                contactId: 'contact-1',
                messageId: 'message-1',
                content: { type: 'TEXT', text: 'imagem recebida' },
                channel: 'WHATSAPP',
            }, 'messaging:inbound:msg-10'),
        ]);

        const result = await sut.execute({ body, signature: 'valid-signature' });

        expect(result).toEqual({ status: 'received' });
        expect(messagingGateway.validateSignature).toHaveBeenCalledWith(
            'valid-signature',
            body,
            expect.objectContaining({
                provider: 'BUBBLEWHATS',
                webhookSecret: 'secret',
            }),
            expect.objectContaining({
                requestUrl: undefined,
                headers: undefined,
            }),
        );
        expect(processInboundUseCase.persistInboundMessage).toHaveBeenCalledWith({
            tenantId: 'tenant-1',
            branchId: null,
            externalMessageId: 'msg-10',
            fromPhone: '123',
            toPhone: '456',
            contentType: 'image',
            content: { text: 'imagem recebida' },
            channel: 'WHATSAPP',
        }, expect.objectContaining({ tx: expect.any(Object) }));
        expect(webhookReceiptStore.markProcessed).toHaveBeenCalledWith(
            'receipt-3',
            expect.any(Object),
        );
    });

    it('should mark the receipt as ignored when inbound persistence detects duplicate message safety', async () => {
        messagingGateway.parseInboundMessage.mockReturnValue({
            from: '123',
            to: '456',
            messageId: 'msg-duplicate-safe',
            type: 'text',
            content: { text: 'oi' }
        });
        tenantFacade.getWhatsAppConfigByNumber.mockResolvedValue({
            tenantId: 'tenant-1',
            config: {
                provider: 'BUBBLEWHATS',
                credentials: {},
                webhookSecret: 'secret',
                whatsappNumber: '456',
                status: 'ACTIVE'
            }
        } as any);
        messagingGateway.validateSignature.mockReturnValue(true);
        webhookReceiptStore.registerReceived.mockResolvedValue({
            id: 'receipt-safe',
            isNew: true,
        });
        processInboundUseCase.persistInboundMessage.mockResolvedValue([]);

        const result = await sut.execute({ body: {}, signature: 'valid' });

        expect(result).toEqual({ status: 'ignored' });
        expect(webhookReceiptStore.markIgnored).toHaveBeenCalledWith(
            'receipt-safe',
            'DUPLICATE_MESSAGE',
            expect.any(Object),
        );
    });
});
