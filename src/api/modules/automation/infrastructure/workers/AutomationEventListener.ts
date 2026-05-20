import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { IEventBus, EVENT_BUS } from '@shared/application/ports/IEventBus';
import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';
import { TriggerAutomationUseCase } from '../../application/use-cases/TriggerAutomationUseCase';
import { TriggerType } from '../../domain/value-objects/TriggerType';

/**
 * Subscribes to domain events via the project's EventBus
 * and triggers matching automations.
 */
@Injectable()
export class AutomationEventListener implements OnModuleInit {
  private readonly logger = new Logger(AutomationEventListener.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly triggerUseCase: TriggerAutomationUseCase,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'automation.contact_created',
      async (event: IntegrationEvent) => {
        const payload = event.payload as any;
        await this.trigger(payload.tenantId, TriggerType.CONTACT_CREATED, payload, payload.contactId);
      },
      { consumerName: 'automation-contact-created', concurrency: 5, retries: 3 },
    );

    this.eventBus.subscribe(
      'automation.tag_added',
      async (event: IntegrationEvent) => {
        const payload = event.payload as any;
        await this.trigger(payload.tenantId, TriggerType.TAG_ADDED, payload, payload.contactId);
      },
      { consumerName: 'automation-tag-added', concurrency: 5, retries: 3 },
    );

    this.eventBus.subscribe(
      'automation.message_received',
      async (event: IntegrationEvent) => {
        const payload = event.payload as any;
        await this.trigger(payload.tenantId, TriggerType.MESSAGE_RECEIVED, payload, payload.contactId);
      },
      { consumerName: 'automation-message-received', concurrency: 5, retries: 3 },
    );

    this.eventBus.subscribe(
      'automation.payment_overdue',
      async (event: IntegrationEvent) => {
        const payload = event.payload as any;
        await this.trigger(payload.tenantId, TriggerType.PAYMENT_OVERDUE, payload, payload.contactId);
      },
      { consumerName: 'automation-payment-overdue', concurrency: 5, retries: 3 },
    );

    this.eventBus.subscribe(
      'automation.appointment_confirmed',
      async (event: IntegrationEvent) => {
        const payload = event.payload as any;
        await this.trigger(payload.tenantId, TriggerType.APPOINTMENT_CONFIRMED, payload, payload.contactId);
      },
      { consumerName: 'automation-appointment-confirmed', concurrency: 5, retries: 3 },
    );

    this.eventBus.subscribe(
      'automation.order_placed',
      async (event: IntegrationEvent) => {
        const payload = event.payload as any;
        await this.trigger(payload.tenantId, TriggerType.ORDER_PLACED, payload, payload.contactId);
      },
      { consumerName: 'automation-order-placed', concurrency: 5, retries: 3 },
    );

    this.eventBus.subscribe(
      'automation.cart_abandoned',
      async (event: IntegrationEvent) => {
        const payload = event.payload as any;
        await this.trigger(payload.tenantId, TriggerType.CART_ABANDONED, payload, payload.contactId);
      },
      { consumerName: 'automation-cart-abandoned', concurrency: 5, retries: 3 },
    );

    this.logger.log('Automation event listeners registered');
  }

  private async trigger(
    tenantId: string,
    triggerType: TriggerType,
    payload: Record<string, unknown>,
    contactId?: string,
  ): Promise<void> {
    try {
      const executionIds = await this.triggerUseCase.execute(
        tenantId,
        triggerType,
        payload,
        contactId,
      );
      if (executionIds.length > 0) {
        this.logger.log(
          `Triggered ${executionIds.length} automation(s) for ${triggerType} in tenant ${tenantId}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`Error triggering automations for ${triggerType}: ${error.message}`);
    }
  }
}
