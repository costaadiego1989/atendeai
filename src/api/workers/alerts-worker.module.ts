import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@modules/auth/auth.module';
import { ContactModule } from '@modules/contact/contact.module';
import { MessagingModule } from '@modules/messaging/messaging.module';
import { AlertsModule } from '@modules/alerts/alerts.module';
import { AlertReminderProcessor } from '@modules/alerts/infrastructure/queue/AlertReminderProcessor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    ContactModule,
    MessagingModule,
    AlertsModule,
  ],
  providers: [AlertReminderProcessor],
})
export class AlertsWorkerModule {}
