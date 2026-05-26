import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { IProspectingQueryPort } from '../../application/ports/IProspectingQueryPort';

/**
 * Adapter implementing IProspectingQueryPort.
 * Encapsulates the cross-schema query to prospecting_schema
 * behind the billing-owned port interface.
 */
@Injectable()
export class ProspectingQueryAdapter implements IProspectingQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async countDailySearches(
    tenantId: string,
    dayStart: Date,
    dayEnd: Date,
  ): Promise<number> {
    try {
      const [row] = await this.prisma.$queryRaw<Array<{ used: number }>>(
        Prisma.sql`
          SELECT COALESCE(SUM(max_results), 0)::int AS used
          FROM prospecting_schema.prospect_searches
          WHERE tenant_id = ${tenantId}::uuid
            AND created_at >= ${dayStart}::timestamptz
            AND created_at < ${dayEnd}::timestamptz
            AND status IN ('RUNNING', 'COMPLETED')
        `,
      );

      return Number(row?.used ?? 0);
    } catch {
      return 0;
    }
  }
}
