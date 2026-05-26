import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ITenantCatalogQueryPort } from '../../application/ports/ITenantCatalogQueryPort';

/**
 * Adapter implementing ITenantCatalogQueryPort.
 * Encapsulates the tenant businessType query behind the billing-owned port interface.
 */
@Injectable()
export class TenantCatalogQueryAdapter implements ITenantCatalogQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findTenantBusinessType(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true },
    });

    return tenant?.businessType ?? null;
  }
}
