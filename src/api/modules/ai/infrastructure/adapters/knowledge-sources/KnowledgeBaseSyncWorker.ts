import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { IngestKnowledgeSourceUseCase } from '../../../application/use-cases/knowledge-base/IngestKnowledgeSourceUseCase';

/**
 * Scheduled worker that re-syncs knowledge sources periodically.
 * Only reprocesses sources whose content has changed (via contentHash comparison).
 */
@Injectable()
export class KnowledgeBaseSyncWorker {
  private readonly logger = new Logger(KnowledgeBaseSyncWorker.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestUseCase: IngestKnowledgeSourceUseCase,
  ) {}

  /**
   * Runs every 6 hours to sync active knowledge sources.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async syncAllSources() {
    if (this.isRunning) {
      this.logger.warn('Sync already running, skipping');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting knowledge base sync...');

    try {
      // Find all active sources that need sync
      const sources = await this.prisma.knowledgeSource.findMany({
        where: {
          status: { in: ['ACTIVE', 'PENDING'] },
          type: { in: ['webpage', 'google-drive', 'notion'] },
        },
        orderBy: { lastSyncAt: 'asc' },
        take: 50, // Process max 50 per run
      });

      this.logger.log(`Found ${sources.length} sources to sync`);

      let synced = 0;
      let errors = 0;

      for (const source of sources) {
        try {
          const result = await this.ingestUseCase.execute({
            tenantId: source.tenantId,
            sourceId: source.id,
            sourceType: source.type as any,
            sourceUrl: source.sourceUrl || '',
            sourceName: source.name,
            credentials: (source.credentials as Record<string, string>) || undefined,
          });

          if (result.success) {
            synced++;
          } else {
            errors++;
            this.logger.warn(`Sync failed for source ${source.id}: ${result.error}`);
          }
        } catch (error: any) {
          errors++;
          this.logger.error(`Sync error for source ${source.id}: ${error.message}`);
        }

        // Small delay between sources to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      this.logger.log(`Sync complete: ${synced} synced, ${errors} errors`);
    } finally {
      this.isRunning = false;
    }
  }
}
