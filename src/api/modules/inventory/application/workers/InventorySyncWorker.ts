import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { SyncInventoryConnectionUseCase } from '../use-cases/SyncInventoryConnectionUseCase';

@Injectable()
export class InventorySyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventorySyncWorker.name);
  private syncInterval: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncInventoryConnectionUseCase: SyncInventoryConnectionUseCase,
  ) {}

  onModuleInit() {
    this.syncInterval = setInterval(() => {
      this.handleHourlySync();
    }, 3600000);
  }

  onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }

  async handleHourlySync() {
    this.logger.log('Starting global inventory sync cycle...');

    try {
      const activeConnections = await this.prisma.inventoryConnection.findMany({
        where: {},
      });

      for (const conn of activeConnections) {
        try {
          await this.syncInventoryConnectionUseCase.execute({
            tenantId: conn.tenantId,
            connectionId: conn.id,
          });
        } catch (error: any) {
          this.logger.error(
            `Failed to execute sync for connection ${conn.id}: ${error.message}`,
          );
        }
      }

      this.logger.log('Global inventory sync cycle completed.');
    } catch (error: any) {
      this.logger.error(`Failed global inventory sync cycle: ${error.message}`);
    }
  }
}
