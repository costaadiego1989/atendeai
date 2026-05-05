import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { ExpirePendingSchedulingReservationUseCase } from '../../application/use-cases/ExpirePendingSchedulingReservationUseCase';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';

@Injectable()
export class SchedulingReservationExpirationProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    SchedulingReservationExpirationProcessor.name,
  );
  private worker: Worker | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly expirePendingSchedulingReservationUseCase: ExpirePendingSchedulingReservationUseCase,
    private readonly structuredLog: StructuredLogEmitter,
  ) {}

  onModuleInit() {
    const connection = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    };

    this.worker = new Worker(
      'scheduling-reservation-expirations',
      async (
        job: Job<{
          tenantId: string;
          professionalId: string;
          date: string;
          slotId: string;
        }>,
      ) => {
        try {
          await this.expirePendingSchedulingReservationUseCase.execute(job.data);
          this.structuredLog.emit({
            level: 'info',
            event: 'scheduling.pending_slot.expiration_job_ok',
            message: 'Pending reservation expiration job completed',
            tenantId: job.data.tenantId,
            attributes: {
              professional_id: job.data.professionalId,
              date: job.data.date,
              slot_id: job.data.slotId,
              bull_job_id:
                typeof job.id === 'string'
                  ? job.id
                  : job.id != null
                    ? String(job.id)
                    : '',
            },
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.structuredLog.emit({
            level: 'warn',
            event: 'scheduling.pending_slot.expiration_job_failed',
            message: 'Failed to expire pending reservation in queue',
            tenantId: job.data.tenantId,
            attributes: {
              professional_id: job.data.professionalId,
              date: job.data.date,
              slot_id: job.data.slotId,
              error_message: message.slice(0, 400),
            },
          });
          throw error;
        }
      },
      {
        connection,
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Scheduling expiration job ${job?.id} failed: ${error.message}`,
      );
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
