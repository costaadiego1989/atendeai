import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ITelephonyProvider,
  TELEPHONY_PROVIDER,
} from '../ports/ITelephonyProvider';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  isWithinCallWindow,
  VoiceAgentConfig,
} from '../../domain/value-objects/NegotiationRules';
import { VoiceNegotiationService } from '../services/VoiceNegotiationService';

export interface MakeOutboundCallCommand {
  tenantId: string;
  contactId: string;
  recoveryCaseId?: string;
  phone: string;
}

export interface MakeOutboundCallResult {
  success: boolean;
  callId?: string;
  externalCallId?: string;
  error?: string;
}

@Injectable()
export class MakeOutboundCallUseCase {
  private readonly logger = new Logger(MakeOutboundCallUseCase.name);

  constructor(
    @Inject(TELEPHONY_PROVIDER)
    private readonly telephony: ITelephonyProvider,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly negotiationService: VoiceNegotiationService,
  ) {}

  async execute(
    command: MakeOutboundCallCommand,
  ): Promise<MakeOutboundCallResult> {
    // 1. Load voice agent config for tenant
    const config = await this.prisma.voiceAgentConfig.findUnique({
      where: { tenantId: command.tenantId },
    });

    if (!config || !config.enabled) {
      return {
        success: false,
        error: 'Voice agent not configured or disabled',
      };
    }

    const agentConfig = this.mapToVoiceAgentConfig(config);

    // 2. Check call window
    if (!isWithinCallWindow(agentConfig)) {
      return { success: false, error: 'Outside call window' };
    }

    // 3. Create call record
    const call = await this.prisma.voiceCall.create({
      data: {
        tenantId: command.tenantId,
        contactId: command.contactId,
        recoveryCaseId: command.recoveryCaseId || null,
        direction: 'OUTBOUND',
        status: 'QUEUED',
      },
    });

    // 4. Make the call via telephony provider
    const apiBaseUrl =
      this.configService.get<string>('API_BASE_URL') ||
      'https://api.atendeai.com';
    const webhookUrl = `${apiBaseUrl}/api/v1/voice/webhook/twiml/${call.id}`;
    const statusUrl = `${apiBaseUrl}/api/v1/voice/webhook/status/${call.id}`;
    const fromNumber =
      this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';

    const result = await this.telephony.makeCall({
      to: command.phone,
      from: fromNumber,
      webhookUrl,
      statusCallbackUrl: statusUrl,
    });

    if (!result.success) {
      await this.prisma.voiceCall.update({
        where: { id: call.id },
        data: { status: 'FAILED' },
      });
      this.logger.error(
        `Call failed for case ${command.recoveryCaseId}: ${result.error}`,
      );
      return { success: false, callId: call.id, error: result.error };
    }

    // 5. Update call with external ID
    await this.prisma.voiceCall.update({
      where: { id: call.id },
      data: {
        status: 'RINGING',
        externalCallId: result.externalCallId,
      },
    });

    this.logger.log(`Outbound call initiated: ${call.id} → ${command.phone}`);

    return {
      success: true,
      callId: call.id,
      externalCallId: result.externalCallId,
    };
  }

  private mapToVoiceAgentConfig(record: any): VoiceAgentConfig {
    return {
      id: record.id,
      tenantId: record.tenantId,
      enabled: record.enabled,
      voiceId: record.voiceId,
      language: record.language || 'pt-BR',
      maxDiscountPercent: record.maxDiscount,
      maxInstallments: record.maxInstallments,
      minInstallmentValue: record.minInstallmentValue || 50,
      callWindowStart: record.callWindowStart,
      callWindowEnd: record.callWindowEnd,
      blockedDays: record.blockedDays || [],
      greeting: record.greeting,
      transferPhone: record.transferPhone,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
