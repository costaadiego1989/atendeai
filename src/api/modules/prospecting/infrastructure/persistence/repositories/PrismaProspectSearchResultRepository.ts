import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ProspectSearchResult } from '../../../domain/entities/ProspectSearchResult';
import { IProspectSearchResultRepository } from '../../../domain/repositories/IProspectSearchResultRepository';
import { ProspectSearchResultMapper } from '../mappers/ProspectSearchResultMapper';

@Injectable()
export class PrismaProspectSearchResultRepository
  implements IProspectSearchResultRepository {
  constructor(private readonly prisma: PrismaService) { }

  async saveMany(results: ProspectSearchResult[]): Promise<void> {
    for (const result of results) {
      const data = ProspectSearchResultMapper.toPersistence(result);

      await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO prospecting_schema.prospect_search_results (
            id,
            tenant_id,
            search_id,
            source,
            external_id,
            business_name,
            city,
            state,
            phone,
            whatsapp_phone,
            instagram_url,
            email,
            website,
            created_at,
            updated_at
          )
          VALUES (
            ${data.id}::uuid,
            ${data.tenantId}::uuid,
            ${data.searchId}::uuid,
            ${data.source},
            ${data.externalId},
            ${data.businessName},
            ${data.city},
            ${data.state},
            ${data.phone},
            ${data.whatsappPhone},
            ${data.instagramUrl},
            ${data.email},
            ${data.website},
            ${data.createdAt}::timestamptz,
            ${data.updatedAt}::timestamptz
          )
          ON CONFLICT (id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            search_id = EXCLUDED.search_id,
            source = EXCLUDED.source,
            external_id = EXCLUDED.external_id,
            business_name = EXCLUDED.business_name,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            phone = EXCLUDED.phone,
            whatsapp_phone = EXCLUDED.whatsapp_phone,
            instagram_url = EXCLUDED.instagram_url,
            email = EXCLUDED.email,
            website = EXCLUDED.website,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        `);
    }
  }

  async deleteBySearch(tenantId: string, searchId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM prospecting_schema.prospect_search_results
        WHERE tenant_id = ${tenantId}::uuid AND search_id = ${searchId}::uuid
      `);
  }

  async findAllBySearch(
    tenantId: string,
    searchId: string,
  ): Promise<ProspectSearchResult[]> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        search_id: string;
        source: string;
        external_id: string | null;
        business_name: string;
        city: string;
        state: string | null;
        phone: string | null;
        whatsapp_phone: string | null;
        instagram_url: string | null;
        email: string | null;
        website: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          search_id,
          source,
          external_id,
          business_name,
          city,
          state,
          phone,
          whatsapp_phone,
          instagram_url,
          email,
          website,
          created_at,
          updated_at
        FROM prospecting_schema.prospect_search_results
        WHERE tenant_id = ${tenantId}::uuid AND search_id = ${searchId}::uuid
        ORDER BY created_at ASC
      `);

    return results.map((raw) => ProspectSearchResultMapper.toDomain(raw));
  }
}
