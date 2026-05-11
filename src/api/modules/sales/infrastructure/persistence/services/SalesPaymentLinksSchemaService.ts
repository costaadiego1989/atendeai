import { Injectable } from '@nestjs/common';

@Injectable()
export class SalesPaymentLinksSchemaService {
  /**
   * No-op. Column management has been moved to a proper Prisma migration:
   * prisma/migrations/20260511203504_sales_schema_consolidation/migration.sql
   */
  async ensureColumns(): Promise<void> {
    return;
  }
}
