import { TenantSubscriptionStatusHandler } from '../application/handlers/TenantSubscriptionStatusHandler.js';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { UpdateTenantPlanStatusUseCase } from '../application/use-cases/UpdateTenantPlanStatusUseCase.js';

describe('TenantSubscriptionStatusHandler', () => {
  let handler: TenantSubscriptionStatusHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let updateTenantPlanStatusUseCase: jest.Mocked<UpdateTenantPlanStatusUseCase>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    updateTenantPlanStatusUseCase = {
      execute: jest.fn(),
    } as any;

    handler = new TenantSubscriptionStatusHandler(eventBus, updateTenantPlanStatusUseCase);
  });

  it('should subscribe to payment events on init', () => {
    handler.onModuleInit();
    expect(eventBus.subscribe).toHaveBeenCalledWith('payment.confirmed', expect.any(Function), expect.any(Object));
    expect(eventBus.subscribe).toHaveBeenCalledWith('payment.overdue', expect.any(Function), expect.any(Object));
  });

  it('should call UpdateTenantPlanStatusUseCase with ACTIVE on payment.confirmed', async () => {
    handler.onModuleInit();
    
    const callback = eventBus.subscribe.mock.calls.find(call => call[0] === 'payment.confirmed')![1];
    
    await callback({ payload: { tenantId: 'tenant-1' } } as any);

    expect(updateTenantPlanStatusUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      status: 'ACTIVE',
    });
  });

  it('should call UpdateTenantPlanStatusUseCase with EXPIRED on payment.overdue', async () => {
    handler.onModuleInit();
    
    const callback = eventBus.subscribe.mock.calls.find(call => call[0] === 'payment.overdue')![1];
    
    await callback({ payload: { tenantId: 'tenant-2' } } as any);

    expect(updateTenantPlanStatusUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-2',
      status: 'EXPIRED',
    });
  });

  it('should ignore event if tenantId is missing', async () => {
    handler.onModuleInit();
    const callback = eventBus.subscribe.mock.calls.find(call => call[0] === 'payment.confirmed')![1];
    
    await callback({ payload: {} } as any);

    expect(updateTenantPlanStatusUseCase.execute).not.toHaveBeenCalled();
  });
});
