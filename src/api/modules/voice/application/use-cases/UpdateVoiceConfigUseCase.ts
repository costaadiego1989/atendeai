import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import type { VoiceAgentConfig } from '@prisma/client';

export interface UpdateVoiceConfigInput {
  enabled?: boolean;
  persona?: {
    voiceId?: string;
    language?: string;
    name?: string;
    tone?: string;
    speed?: number;
  };
  allowedHours?: { start?: string; end?: string; daysOfWeek?: number[] };
  recovery?: Record<string, unknown>;
  scripts?: unknown[];
  twilioPhoneNumber?: string | null;
  // flat fields (legacy / direct)
  voiceId?: string;
  language?: string;
  maxDiscount?: number;
  maxInstallments?: number;
  callWindowStart?: string;
  callWindowEnd?: string;
  blockedDays?: string[];
}

@Injectable()
export class UpdateVoiceConfigUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(tenantId: string, input: UpdateVoiceConfigInput) {
    const flat = this.flatten(input);
    const config = await this.prisma.voiceAgentConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...flat },
      update: flat,
    });
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

  private flatten(input: UpdateVoiceConfigInput) {
    return {
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(input.voiceId !== undefined && { voiceId: input.voiceId }),
      ...(input.persona?.voiceId !== undefined && {
        voiceId: input.persona.voiceId,
      }),
      ...(input.language !== undefined && { language: input.language }),
      ...(input.persona?.language !== undefined && {
        language: input.persona.language,
      }),
      ...(input.maxDiscount !== undefined && {
        maxDiscount: input.maxDiscount,
      }),
      ...(input.maxInstallments !== undefined && {
        maxInstallments: input.maxInstallments,
      }),
      ...(input.callWindowStart !== undefined && {
        callWindowStart: input.callWindowStart,
      }),
      ...(input.allowedHours?.start !== undefined && {
        callWindowStart: input.allowedHours.start,
      }),
      ...(input.callWindowEnd !== undefined && {
        callWindowEnd: input.callWindowEnd,
      }),
      ...(input.allowedHours?.end !== undefined && {
        callWindowEnd: input.allowedHours.end,
      }),
      ...(input.blockedDays !== undefined && {
        blockedDays: input.blockedDays,
      }),
    };
  }
}
