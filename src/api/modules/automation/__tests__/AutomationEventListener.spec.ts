import { AutomationEventListener } from '../infrastructure/workers/AutomationEventListener';
import { TriggerAutomationUseCase } from '../application/use-cases/TriggerAutomationUseCase';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { TriggerType } from '../domain/value-objects/TriggerType';

describe('AutomationEventListener', () => {
  let listener: AutomationEventListener;
  let eventBus: jest.Mocked<IEventBus>;
  let triggerUseCase: jest.Mocked<TriggerAutomationUseCase>;
  let subscriptions: Map<string, Function>;

  beforeEach(() => {
    subscriptions = new Map();

    eventBus = {
      subscribe: jest.fn((queue: string, handler: Function) => {
        subscriptions.set(queue, handler);
      }),
      publish: jest.fn(),
    } as any;

    triggerUseCase = {
      execute: jest.fn().mockResolvedValue([]),
    } as any;

    listener = new AutomationEventListener(eventBus, triggerUseCase);
  });

  describe('onModuleInit', () => {
    it('should register 7 event subscriptions', () => {
      listener.onModuleInit();

      expect(eventBus.subscribe).toHaveBeenCalledTimes(7);
    });

    it('should subscribe to all expected event queues', () => {
      listener.onModuleInit();

      const queues = (eventBus.subscribe as jest.Mock).mock.calls.map((c) => c[0]);
      expect(queues).toContain('automation.contact_created');
      expect(queues).toContain('automation.tag_added');
      expect(queues).toContain('automation.message_received');
      expect(queues).toContain('automation.payment_overdue');
      expect(queues).toContain('automation.appointment_confirmed');
      expect(queues).toContain('automation.order_placed');
      expect(queues).toContain('automation.cart_abandoned');
    });
  });

  describe('event handlers', () => {
    beforeEach(() => {
      listener.onModuleInit();
    });

    it('should trigger automation on contact_created event', async () => {
      triggerUseCase.execute.mockResolvedValue(['exec-1']);

      const handler = subscriptions.get('automation.contact_created')!;
      await handler({
        payload: { tenantId: 'tenant-1', contactId: 'contact-1', name: 'João' },
      });

      expect(triggerUseCase.execute).toHaveBeenCalledWith(
        'tenant-1',
        TriggerType.CONTACT_CREATED,
        expect.objectContaining({ tenantId: 'tenant-1', contactId: 'contact-1' }),
        'contact-1',
      );
    });

    it('should trigger automation on message_received event', async () => {
      const handler = subscriptions.get('automation.message_received')!;
      await handler({
        payload: { tenantId: 'tenant-1', contactId: 'contact-2', text: 'hello' },
      });

      expect(triggerUseCase.execute).toHaveBeenCalledWith(
        'tenant-1',
        TriggerType.MESSAGE_RECEIVED,
        expect.objectContaining({ text: 'hello' }),
        'contact-2',
      );
    });

    it('should trigger automation on payment_overdue event', async () => {
      const handler = subscriptions.get('automation.payment_overdue')!;
      await handler({
        payload: { tenantId: 'tenant-1', contactId: 'contact-3', amount: 200 },
      });

      expect(triggerUseCase.execute).toHaveBeenCalledWith(
        'tenant-1',
        TriggerType.PAYMENT_OVERDUE,
        expect.objectContaining({ amount: 200 }),
        'contact-3',
      );
    });

    it('should not throw when triggerUseCase fails', async () => {
      triggerUseCase.execute.mockRejectedValue(new Error('DB connection lost'));

      const handler = subscriptions.get('automation.order_placed')!;

      // Should not throw
      await expect(
        handler({ payload: { tenantId: 'tenant-1', contactId: 'c1' } }),
      ).resolves.not.toThrow();
    });
  });
});
