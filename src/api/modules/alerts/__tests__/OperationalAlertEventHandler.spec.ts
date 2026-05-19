import { OperationalAlertEventHandler } from '../application/handlers/OperationalAlertEventHandler';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { IMessagingFacade } from '@modules/messaging/application/facades/MessagingFacade';
import { IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import { IUserRepository } from '@modules/tenant/domain/repositories/IUserRepository';

describe('OperationalAlertEventHandler', () => {
  let handler: OperationalAlertEventHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let messagingFacade: jest.Mocked<IMessagingFacade>;
  let contactFacade: jest.Mocked<IContactFacade>;
  let userRepository: jest.Mocked<Pick<IUserRepository, 'findAllByTenant'>>;

  const mockUser = (overrides: Partial<{ id: string; name: string; phone: string; role: string }> = {}) => ({
    id: { toValue: () => overrides.id ?? 'user-1' },
    name: overrides.name ?? 'João Operador',
    phone: { value: overrides.phone ?? '+5511999990000' },
    email: { value: 'joao@test.com' },
    role: { value: overrides.role ?? 'OPERATOR' },
    mustChangePassword: false,
  });

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    messagingFacade = {
      queueSystemMessage: jest.fn().mockResolvedValue({ conversationId: 'conv-1', messageId: 'msg-1' }),
      queueTemplateMessage: jest.fn(),
    };

    contactFacade = {
      ensureContact: jest.fn().mockResolvedValue({ contactId: 'contact-1', created: false }),
      identifyContact: jest.fn(),
      getContactById: jest.fn(),
      upsertProspectContact: jest.fn(),
    } as any;

    userRepository = {
      findAllByTenant: jest.fn().mockResolvedValue([]),
    };

    handler = new OperationalAlertEventHandler(
      eventBus,
      messagingFacade as any,
      contactFacade as any,
      userRepository as any,
    );
  });

  describe('onModuleInit', () => {
    it('should subscribe to scheduling.professional_slot.reserved', () => {
      handler.onModuleInit();

      expect(eventBus.subscribe).toHaveBeenCalledWith(
        'scheduling.professional_slot.reserved',
        expect.any(Function),
        expect.objectContaining({ consumerName: 'alerts' }),
      );
    });

    it('should subscribe to scheduling.professional_slot.payment_confirmed', () => {
      handler.onModuleInit();

      expect(eventBus.subscribe).toHaveBeenCalledWith(
        'scheduling.professional_slot.payment_confirmed',
        expect.any(Function),
        expect.objectContaining({ consumerName: 'alerts' }),
      );
    });

    it('should subscribe to commerce.order.paid', () => {
      handler.onModuleInit();

      expect(eventBus.subscribe).toHaveBeenCalledWith(
        'commerce.order.paid',
        expect.any(Function),
        expect.objectContaining({ consumerName: 'alerts' }),
      );
    });
  });

  describe('handleSchedulingReserved', () => {
    const payload = {
      tenantId: 'tenant-1',
      contactId: 'contact-abc',
      professionalName: 'Dr. Silva',
      categoryName: 'Consulta',
      date: '2026-05-20',
      startsAt: '10:00',
      endsAt: '11:00',
      branchId: 'branch-1',
    };

    it('should notify all tenant users when a slot is reserved', async () => {
      userRepository.findAllByTenant.mockResolvedValue([mockUser()] as any);

      await handler.handleSchedulingReserved(payload);

      expect(userRepository.findAllByTenant).toHaveBeenCalledWith('tenant-1');
      expect(contactFacade.ensureContact).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'João Operador',
          phone: '+5511999990000',
        }),
      );
      expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          contactId: 'contact-1',
          channel: 'WHATSAPP',
        }),
      );
    });

    it('should include scheduling details in the message text', async () => {
      userRepository.findAllByTenant.mockResolvedValue([mockUser()] as any);

      await handler.handleSchedulingReserved(payload);

      const call = messagingFacade.queueSystemMessage.mock.calls[0][0];
      expect(call.text).toContain('Dr. Silva');
      expect(call.text).toContain('Consulta');
      expect(call.text).toContain('2026-05-20');
      expect(call.text).toContain('10:00');
    });

    it('should notify multiple users', async () => {
      userRepository.findAllByTenant.mockResolvedValue([
        mockUser({ id: 'user-1', phone: '+5511111111111' }),
        mockUser({ id: 'user-2', phone: '+5522222222222', name: 'Maria' }),
      ] as any);

      await handler.handleSchedulingReserved(payload);

      expect(contactFacade.ensureContact).toHaveBeenCalledTimes(2);
      expect(messagingFacade.queueSystemMessage).toHaveBeenCalledTimes(2);
    });

    it('should skip users without phone', async () => {
      userRepository.findAllByTenant.mockResolvedValue([
        mockUser({ phone: '' }),
      ] as any);

      await handler.handleSchedulingReserved(payload);

      expect(contactFacade.ensureContact).not.toHaveBeenCalled();
      expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
    });

    it('should not throw if no users exist for tenant', async () => {
      userRepository.findAllByTenant.mockResolvedValue([]);

      await expect(handler.handleSchedulingReserved(payload)).resolves.not.toThrow();
      expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
    });

    it('should continue notifying other users if one fails', async () => {
      userRepository.findAllByTenant.mockResolvedValue([
        mockUser({ id: 'user-1', phone: '+5511111111111' }),
        mockUser({ id: 'user-2', phone: '+5522222222222' }),
      ] as any);

      contactFacade.ensureContact
        .mockResolvedValueOnce({ contactId: 'c-1', created: false })
        .mockRejectedValueOnce(new Error('fail'));

      // Should not throw — errors are caught per-user
      await expect(handler.handleSchedulingReserved(payload)).resolves.not.toThrow();
      expect(messagingFacade.queueSystemMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleSchedulingPaymentConfirmed', () => {
    const payload = {
      tenantId: 'tenant-1',
      contactId: 'contact-abc',
      contactName: 'Cliente X',
      professionalName: 'Dr. Silva',
      categoryName: 'Consulta',
      date: '2026-05-20',
      startsAt: '10:00',
      endsAt: '11:00',
      branchId: 'branch-1',
    };

    it('should notify users when scheduling payment is confirmed', async () => {
      userRepository.findAllByTenant.mockResolvedValue([mockUser()] as any);

      await handler.handleSchedulingPaymentConfirmed(payload);

      expect(userRepository.findAllByTenant).toHaveBeenCalledWith('tenant-1');
      expect(messagingFacade.queueSystemMessage).toHaveBeenCalledTimes(1);
    });

    it('should include payment confirmation context in message', async () => {
      userRepository.findAllByTenant.mockResolvedValue([mockUser()] as any);

      await handler.handleSchedulingPaymentConfirmed(payload);

      const call = messagingFacade.queueSystemMessage.mock.calls[0][0];
      expect(call.text).toContain('pagamento confirmado');
      expect(call.text).toContain('Dr. Silva');
      expect(call.text).toContain('Consulta');
    });
  });

  describe('handleCommerceOrderPaid', () => {
    const payload = {
      orderId: 'order-123',
      tenantId: 'tenant-1',
      paidAt: new Date('2026-05-19T18:00:00Z'),
      totalAmount: 15990,
    };

    it('should notify users when an order is paid', async () => {
      userRepository.findAllByTenant.mockResolvedValue([mockUser()] as any);

      await handler.handleCommerceOrderPaid(payload);

      expect(userRepository.findAllByTenant).toHaveBeenCalledWith('tenant-1');
      expect(messagingFacade.queueSystemMessage).toHaveBeenCalledTimes(1);
    });

    it('should include order details in message', async () => {
      userRepository.findAllByTenant.mockResolvedValue([mockUser()] as any);

      await handler.handleCommerceOrderPaid(payload);

      const call = messagingFacade.queueSystemMessage.mock.calls[0][0];
      expect(call.text).toContain('order-123');
      expect(call.text).toContain('159,90');
    });

    it('should not throw if no users exist', async () => {
      userRepository.findAllByTenant.mockResolvedValue([]);

      await expect(handler.handleCommerceOrderPaid(payload)).resolves.not.toThrow();
      expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
    });
  });
});
