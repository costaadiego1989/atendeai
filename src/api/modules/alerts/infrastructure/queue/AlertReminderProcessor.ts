import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { ProcessAlertReminderUseCase } from '../../application/use-cases/ProcessAlertReminderUseCase';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';
import { parseRedisConnection } from '@shared/infrastructure/redis/redis-connection.helper';

@Injectable()
export class AlertReminderProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertReminderProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly processAlertReminderUseCase: ProcessAlertReminderUseCase,
  ) {}

  onModuleInit() {
    const connection = parseRedisConnection(this.configService);

    this.worker = new Worker(
      'alert-reminders',
      async (job: Job<{ tenantId: string; reminderId: string; runAt: string }>) => {
        const jid = job.id ?? 'n/a';
        this.logger.log(
          `[alert-reminders] start job=${jid} tenant=${job.data.tenantId} reminder=${job.data.reminderId} runAt=${job.data.runAt}`,
        );

        await traceAsync(
          'alerts.AlertReminderProcessor.processJob',
          {
            'tenant.id': job.data.tenantId,
            'alerts.reminder.id': job.data.reminderId,
            'alerts.job.id': String(jid),
          },
          async () =>
            this.processAlertReminderUseCase.execute({
              tenantId: job.data.tenantId,
              reminderId: job.data.reminderId,
              jobId: String(jid),
            }),
        );
      },
      {
        connection,
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `[alert-reminders] fail job=${job?.id ?? 'n/a'} tenant=${job?.data?.tenantId ?? 'n/a'} reminder=${job?.data?.reminderId ?? 'n/a'} err=${error.message}`,
      );
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
