import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingContextProvider,
  SCHEDULING_CONTEXT_PROVIDER,
} from '../ports/ISchedulingContextProvider';
import {
  ICommerceContextProvider,
  COMMERCE_CONTEXT_PROVIDER,
} from '../ports/ICommerceContextProvider';
import {
  ITenantAIContextSnapshotStore,
  TenantAIContextSnapshot,
  TENANT_AI_CONTEXT_SNAPSHOT_STORE,
} from '../ports/ITenantAIContextSnapshot';

@Injectable()
export class TenantAIContextSnapshotService {
  constructor(
    @Inject(SCHEDULING_CONTEXT_PROVIDER)
    private readonly schedulingContextProvider: ISchedulingContextProvider,
    @Inject(COMMERCE_CONTEXT_PROVIDER)
    private readonly commerceContextProvider: ICommerceContextProvider,
    @Inject(TENANT_AI_CONTEXT_SNAPSHOT_STORE)
    private readonly store: ITenantAIContextSnapshotStore,
  ) {}

  async getOrBuild(tenantId: string): Promise<TenantAIContextSnapshot> {
    const cached = await this.store.get(tenantId);
    if (cached) {
      return cached;
    }
    const snapshot = await this.build(tenantId);
    await this.store.set(tenantId, snapshot);
    return snapshot;
  }

  async invalidate(tenantId: string): Promise<void> {
    await this.store.delete(tenantId);
  }

  private async build(tenantId: string): Promise<TenantAIContextSnapshot> {
    const [schedulingCategories, commerceCatalogItemCount] = await Promise.all([
      this.schedulingContextProvider.getSchedulingCategories(tenantId),
      this.commerceContextProvider.getCatalogItemCount(tenantId),
    ]);

    return {
      tenantId,
      generatedAt: new Date(),
      schedulingCategories,
      commerceCatalogItemCount,
    };
  }
}
