import { Injectable, Logger } from '@nestjs/common';
import { IPasswordResetEmailSender } from '@modules/auth/application/ports/IPasswordResetEmailSender';

@Injectable()
export class ConsolePasswordResetEmailSender implements IPasswordResetEmailSender {
  private readonly logger = new Logger(ConsolePasswordResetEmailSender.name);

  async send(input: {
    email: string;
    name: string;
    resetUrl: string;
    expiresAt: Date;
  }): Promise<void> {
    this.logger.log(
      [
        `Password reset requested for ${input.email}`,
        `recipientName=${input.name}`,
        `resetUrl=${input.resetUrl}`,
        `expiresAt=${input.expiresAt.toISOString()}`,
      ].join(' | '),
    );
  }
}
