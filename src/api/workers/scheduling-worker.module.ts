import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SchedulingModule } from '@modules/scheduling/scheduling.module';
import { MessagingModule } from '@modules/messaging/messaging.module';
import { ContactModule } from '@modules/contact/contact.module';
import { AuthModule } from '@modules/auth/auth.module';
import { SchedulingReservationExpirationProcessor } from '@modules/scheduling/infrastructure/queue/SchedulingReservationExpirationProcessor';
import { ObservabilityModule } from '@shared/infrastructure/observability/observability.module';

@Module({
  imports: [
    ObservabilityModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    ContactModule,
    MessagingModule,
    SchedulingModule,
  ],
  providers: [SchedulingReservationExpirationProcessor],
})
export class SchedulingWorkerModule {}
