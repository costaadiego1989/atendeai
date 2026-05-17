import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ProspectSearch } from '../../../domain/entities/ProspectSearch';
import { IProspectSearchRepository } from '../../../domain/repositories/IProspectSearchRepository';
import { ProspectSearchMapper } from '../mappers/ProspectSearchMapper';

@Injectable()
export class PrismaProspectSearchRepository implements IProspectSearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(search: ProspectSearch): Promise<void> {
    const data = ProspectSearchMapper.toPersistence(search);

    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO prospecting_schema.prospect_searches (
          id,
          tenant_id,
          business_type_query,
          city,
          state,
          neighborhood,
          source,
          max_results,
          status,
          discovered_count,
          failure_reason,
          created_at,
          updated_at
        )
        VALUES (
          ${data.id}::uuid,
          ${data.tenantId}::uuid,
          ${data.businessTypeQuery},
          ${data.city},
          ${data.state},
          ${data.neighborhood},
          ${data.source},
          ${data.maxResults},
          ${data.status},
          ${data.discoveredCount},
          ${data.failureReason},
          ${data.createdAt}::timestamptz,
          ${data.updatedAt}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          business_type_query = EXCLUDED.business_type_query,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          neighborhood = EXCLUDED.neighborhood,
          source = EXCLUDED.source,
          max_results = EXCLUDED.max_results,
          status = EXCLUDED.status,
          discovered_count = EXCLUDED.discovered_count,
          failure_reason = EXCLUDED.failure_reason,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `);
  }

  async findById(tenantId: string, id: string): Promise<ProspectSearch | null> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        business_type_query: string;
        city: string;
        state: string | null;
        neighborhood: string | null;
        source: string;
        max_results: number;
        status: string;
        discovered_count: number;
        failure_reason: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          business_type_query,
          city,
          state,
          neighborhood,
          source,
          max_results,
          status,
          discovered_count,
          failure_reason,
          created_at,
          updated_at
        FROM prospecting_schema.prospect_searches
        WHERE tenant_id = ${tenantId}::uuid AND id = ${id}::uuid
        LIMIT 1
      `);

    const raw = results[0];
    return raw ? ProspectSearchMapper.toDomain(raw) : null;
  }

  async findBySearchId(id: string): Promise<ProspectSearch | null> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        business_type_query: string;
        city: string;
        state: string | null;
        neighborhood: string | null;
        source: string;
        max_results: number;
        status: string;
        discovered_count: number;
        failure_reason: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          business_type_query,
          city,
          state,
          neighborhood,
          source,
          max_results,
          status,
          discovered_count,
          failure_reason,
          created_at,
          updated_at
        FROM prospecting_schema.prospect_searches
        WHERE id = ${id}::uuid
        LIMIT 1
      `);

    const raw = results[0];
    return raw ? ProspectSearchMapper.toDomain(raw) : null;
  }

  async findAllByTenant(tenantId: string): Promise<ProspectSearch[]> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        business_type_query: string;
        city: string;
        state: string | null;
        neighborhood: string | null;
        source: string;
        max_results: number;
        status: string;
        discovered_count: number;
        failure_reason: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          business_type_query,
          city,
          state,
          neighborhood,
          source,
          max_results,
          status,
          discovered_count,
          failure_reason,
          created_at,
          updated_at
        FROM prospecting_schema.prospect_searches
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY created_at DESC
      `);

    return results.map(ProspectSearchMapper.toDomain);
  }
}
