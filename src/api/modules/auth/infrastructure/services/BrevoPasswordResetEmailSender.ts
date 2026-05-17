import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { IPasswordResetEmailSender } from '@modules/auth/application/ports/IPasswordResetEmailSender';

@Injectable()
export class BrevoPasswordResetEmailSender implements IPasswordResetEmailSender {
  private readonly logger = new Logger(BrevoPasswordResetEmailSender.name);
  private readonly transporter: any;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor(private readonly configService: ConfigService) {
    const login = this.configService.getOrThrow<string>('BREVO_SMTP_LOGIN');
    const password = this.configService.getOrThrow<string>('BREVO_SMTP_KEY');

    this.senderEmail = this.configService.get<string>(
      'BREVO_SMTP_SENDER_EMAIL',
      login,
    );
    this.senderName = this.configService.get<string>(
      'BREVO_SMTP_SENDER_NAME',
      'AtendeAi',
    );

    this.transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: login,
        pass: password,
      },
    });
  }

  async send(input: {
    email: string;
    name: string;
    resetUrl: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.transporter.sendMail({
      from: {
        name: this.senderName,
        address: this.senderEmail,
      },
      to: [
        {
          name: input.name,
          address: input.email,
        },
      ],
      subject: 'Redefinição de senha - AtendeAi',
      text: [
        `Oi ${input.name},`,
        '',
        'Recebemos um pedido para redefinir sua senha.',
        `Use este link para criar uma nova senha: ${input.resetUrl}`,
        `Esse link expira em ${input.expiresAt.toISOString()}.`,
        '',
        'Se voce não pediu essa troca, pode ignorar este email.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p>Oi ${input.name},</p>
          <p>Recebemos um pedido para redefinir sua senha.</p>
          <p>
            <a href="${input.resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111827;color:#ffffff;text-decoration:none;">
              Redefinir senha
            </a>
          </p>
          <p>Se preferir, copie este link:</p>
          <p><a href="${input.resetUrl}">${input.resetUrl}</a></p>
          <p>Esse link expira em ${input.expiresAt.toISOString()}.</p>
          <p>Se voce não pediu essa troca, pode ignorar este email.</p>
        </div>
      `,
    });

    this.logger.log(`Password reset email sent to ${input.email}`);
  }
}
