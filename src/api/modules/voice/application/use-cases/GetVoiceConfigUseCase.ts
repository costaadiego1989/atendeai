import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import type { VoiceAgentConfig } from '@prisma/client';

@Injectable()
export class GetVoiceConfigUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(tenantId: string) {
    let config = await this.prisma.voiceAgentConfig.findUnique({
      where: { tenantId },
    });
    if (!config) {
      config = await this.prisma.voiceAgentConfig.create({
        data: { tenantId },
      });
    }
    return this.toVoiceConfig(config);
  }

  private toVoiceConfig(c: VoiceAgentConfig) {
    return {
      enabled: c.enabled,
      persona: {
        name: 'Assistente de Voz',
        tone: 'professional' as const,
        voiceId: c.voiceId || '',
        language: c.language || 'pt-BR',
      },
      allowedHours: {
        start: c.callWindowStart || '09:00',
        end: c.callWindowEnd || '18:00',
      },
      recovery: {
        enabled: false,
        daysAfterDue: 3,
        minAmount: 50,
        maxAttempts: 3,
        intervalHours: 24,
      },
      scripts: [] as unknown[],
      twilioPhoneNumber: null as string | null,
    };
  }
}
