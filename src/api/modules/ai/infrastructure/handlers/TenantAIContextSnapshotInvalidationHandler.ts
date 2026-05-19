import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { TenantAIContextSnapshotService } from '../../application/services/TenantAIContextSnapshotService';

@Injectable()
export class TenantAIContextSnapshotInvalidationHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly snapshotService: TenantAIContextSnapshotService,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'tenant.ai-config-updated',
      async (event) => {
        const tenantId = (event.payload as { aggregateId: string }).aggregateId;
        await this.snapshotService.invalidate(tenantId);
      },
      { consumerName: 'snapshot-invalidation-tenant-ai-config-updated' },
    );

    this.eventBus.subscribe(
      'tenant.plan-changed',
      async (event) => {
        const tenantId = (event.payload as { aggregateId: string }).aggregateId;
        await this.snapshotService.invalidate(tenantId);
      },
      { consumerName: 'snapshot-invalidation-tenant-plan-changed' },
    );

    this.eventBus.subscribe(
      'catalog.item-created',
      async (event) => {
        const tenantId = (event.payload as { tenantId: string }).tenantId;
        await this.snapshotService.invalidate(tenantId);
      },
      { consumerName: 'snapshot-invalidation-catalog-item-created' },
    );

    this.eventBus.subscribe(
      'catalog.item-updated',
      async (event) => {
        const tenantId = (event.payload as { tenantId: string }).tenantId;
        await this.snapshotService.invalidate(tenantId);
      },
      { consumerName: 'snapshot-invalidation-catalog-item-updated' },
    );

    this.eventBus.subscribe(
      'catalog.item-deactivated',
      async (event) => {
        const tenantId = (event.payload as { tenantId: string }).tenantId;
        await this.snapshotService.invalidate(tenantId);
      },
      { consumerName: 'snapshot-invalidation-catalog-item-deactivated' },
    );

    this.eventBus.subscribe(
      'billing.subscription-provisioned',
      async (event) => {
        const tenantId = (event.payload as { tenantId: string }).tenantId;
        await this.snapshotService.invalidate(tenantId);
      },
      {
        consumerName: 'snapshot-invalidation-billing-subscription-provisioned',
      },
    );

    this.eventBus.subscribe(
      'billing.subscription-activated',
      async (event) => {
        const tenantId = (event.payload as { tenantId: string }).tenantId;
        await this.snapshotService.invalidate(tenantId);
      },
      { consumerName: 'snapshot-invalidation-billing-subscription-activated' },
    );
  }
}
