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

  toVoiceConfig(c: VoiceAgentConfig) {
    const persona = (c.persona as Record<string, unknown>) ?? {};
    const scripts = (c.scripts as unknown[]) ?? [];
    const recoveryConfig =
      (c.recoveryConfig as Record<string, unknown>) ?? null;

    return {
      enabled: c.enabled,
      persona: {
        name: (persona.name as string) || 'Assistente de Voz',
        tone: (persona.tone as string) || 'professional',
        voiceId: (persona.voiceId as string) || c.voiceId || '',
        language: (persona.language as string) || c.language || 'pt-BR',
        speed: (persona.speed as number) || 1.0,
      },
      allowedHours: {
        start: c.callWindowStart || '09:00',
        end: c.callWindowEnd || '18:00',
      },
      recovery: recoveryConfig
        ? recoveryConfig
        : {
            enabled: false,
            daysAfterDue: 3,
            minAmount: 50,
            maxAttempts: 3,
            intervalHours: 24,
          },
      scripts,
      twilioPhoneNumber: c.twilioPhoneNumber ?? null,
      activeScriptName: c.activeScriptName ?? null,
    };
  }
}
