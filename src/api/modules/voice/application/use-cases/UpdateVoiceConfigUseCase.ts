import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { GetVoiceConfigUseCase } from './GetVoiceConfigUseCase';

export interface UpdateVoiceConfigInput {
  enabled?: boolean;
  persona?: {
    name?: string;
    voiceId?: string;
    language?: string;
    tone?: string;
    speed?: number;
  };
  allowedHours?: { start?: string; end?: string; daysOfWeek?: number[] };
  recovery?: Record<string, unknown>;
  scripts?: unknown[];
  twilioPhoneNumber?: string | null;
  activeScriptName?: string | null;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly getVoiceConfig: GetVoiceConfigUseCase,
  ) {}

  async execute(tenantId: string, input: UpdateVoiceConfigInput) {
    const existing = await this.prisma.voiceAgentConfig.findUnique({
      where: { tenantId },
    });

    const flat = this.flatten(input, existing);
    const config = await this.prisma.voiceAgentConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...flat },
      update: flat,
    });
    return this.getVoiceConfig.toVoiceConfig(config);
  }

  private flatten(input: UpdateVoiceConfigInput, existing: any) {
    const result: Record<string, unknown> = {};

    if (input.enabled !== undefined) result.enabled = input.enabled;

    // Persona — merge with existing
    if (input.persona) {
      const existingPersona =
        (existing?.persona as Record<string, unknown>) ?? {};
      result.persona = { ...existingPersona, ...input.persona };
      if (input.persona.voiceId !== undefined)
        result.voiceId = input.persona.voiceId;
      if (input.persona.language !== undefined)
        result.language = input.persona.language;
    }
    if (input.voiceId !== undefined) result.voiceId = input.voiceId;
    if (input.language !== undefined) result.language = input.language;

    if (input.allowedHours?.start !== undefined)
      result.callWindowStart = input.allowedHours.start;
    if (input.allowedHours?.end !== undefined)
      result.callWindowEnd = input.allowedHours.end;
    if (input.callWindowStart !== undefined)
      result.callWindowStart = input.callWindowStart;
    if (input.callWindowEnd !== undefined)
      result.callWindowEnd = input.callWindowEnd;

    if (input.maxDiscount !== undefined) result.maxDiscount = input.maxDiscount;
    if (input.maxInstallments !== undefined)
      result.maxInstallments = input.maxInstallments;
    if (input.blockedDays !== undefined) result.blockedDays = input.blockedDays;

    if (input.scripts !== undefined) result.scripts = input.scripts;
    if (input.recovery !== undefined) result.recoveryConfig = input.recovery;
    if (input.twilioPhoneNumber !== undefined)
      result.twilioPhoneNumber = input.twilioPhoneNumber;
    if (input.activeScriptName !== undefined)
      result.activeScriptName = input.activeScriptName;

    return result;
  }
}
