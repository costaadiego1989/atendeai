import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  ITeamMemberCredentialsEmailSender,
  TeamMemberCredentialsEmailInput,
} from '../../application/ports/ITeamMemberCredentialsEmailSender';

@Injectable()
export class BrevoTeamMemberCredentialsEmailSender implements ITeamMemberCredentialsEmailSender {
  private readonly logger = new Logger(
    BrevoTeamMemberCredentialsEmailSender.name,
  );
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

  async send(input: TeamMemberCredentialsEmailInput): Promise<void> {
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
      subject: `Seu acesso ao AtendeAi - ${input.tenantName}`,
      text: [
        `Oi ${input.name},`,
        '',
        `Voce foi adicionado(a) ao time da empresa ${input.tenantName}.`,
        `Acesse: ${input.loginUrl}`,
        `Senha provisoria: ${input.temporaryPassword}`,
        '',
        'No primeiro login, voce sera direcionado(a) para trocar essa senha.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p>Oi ${input.name},</p>
          <p>Voce foi adicionado(a) ao time da empresa <strong>${input.tenantName}</strong>.</p>
          <p>
            <a href="${input.loginUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111827;color:#ffffff;text-decoration:none;">
              Acessar plataforma
            </a>
          </p>
          <p><strong>Senha provisoria:</strong> ${input.temporaryPassword}</p>
          <p>No primeiro login, voce sera direcionado(a) para trocar essa senha.</p>
        </div>
      `,
    });

    this.logger.log(`Team member credentials email sent to ${input.email}`);
  }
}
