import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { TenantCreatedIntegrationEvent } from '../integration-events/TenantIntegrationEvents';
import { TenantTwilioAccountService } from '../services/TenantTwilioAccountService';

@Injectable()
export class TenantTwilioProvisioningHandler implements OnModuleInit {
  private readonly logger = new Logger(TenantTwilioProvisioningHandler.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly tenantTwilioAccountService: TenantTwilioAccountService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(
      'tenant.created',
      async (event) => this.handle(event as TenantCreatedIntegrationEvent),
      {
        consumerName: 'tenant-twilio-provisioning',
        retries: 3,
      },
    );
  }

  private async handle(event: TenantCreatedIntegrationEvent): Promise<void> {
    if (this.configService.get<string>('TWILIO_AUTO_PROVISION_TENANTS', 'true') === 'false') {
      return;
    }

    const payload = event.payload as {
      aggregateId?: string;
      companyName?: string;
    };

    if (!payload.aggregateId || !payload.companyName) {
      return;
    }

    try {
      await this.tenantTwilioAccountService.provisionTenantSubaccount({
        tenantId: payload.aggregateId,
        companyName: payload.companyName,
      });
    } catch (error) {
      this.logger.error(
        `Failed to provision Twilio subaccount for tenant ${payload.aggregateId}`,
        error,
      );
    }
  }
}
