import { Injectable } from '@nestjs/common';

/**
 * @deprecated Schema is now managed via Prisma migration
 * 20260511203505_recovery_schema_consolidation. This class is kept as a
 * no-op so existing module registrations don't break.
 */
@Injectable()
export class RecoverySchemaBootstrapService {}
