import { TrialPaymentConfirmedHandler } from '../application/handlers/TrialPaymentConfirmedHandler.js';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { OnboardTrialTenantUseCase } from '../application/use-cases/OnboardTrialTenantUseCase.js';

describe('TrialPaymentConfirmedHandler', () => {
  let handler: TrialPaymentConfirmedHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let onboardTrialTenantUseCase: jest.Mocked<OnboardTrialTenantUseCase>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    onboardTrialTenantUseCase = {
      execute: jest.fn(),
    } as any;

    handler = new TrialPaymentConfirmedHandler(eventBus, onboardTrialTenantUseCase);
  });

  it('should subscribe to payment.trial-confirmed on init', () => {
    handler.onModuleInit();
    expect(eventBus.subscribe).toHaveBeenCalledWith('payment.trial-confirmed', expect.any(Function), expect.any(Object));
  });

  it('should call OnboardTrialTenantUseCase when event is received', async () => {
    handler.onModuleInit();
    
    const callback = eventBus.subscribe.mock.calls.find(call => call[0] === 'payment.trial-confirmed')![1];
    
    const event = {
      payload: {
        plan: 'ESSENCIAL',
        companyName: 'Trial Corp',
        ownerName: 'Admin',
        ownerEmail: 'admin@trial.com',
        ownerPhone: '5511999998888',
      }
    };

    await callback(event as any);

    expect(onboardTrialTenantUseCase.execute).toHaveBeenCalledWith(event.payload);
  });
});
