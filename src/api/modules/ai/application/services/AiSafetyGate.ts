export interface AiSafetyGateOptions {
  readonly safetyModeEnabled: boolean;
  readonly blockedSubstrings: string[];
  readonly platformSystemAppend: string;
}

export class AiSafetyGate {
  constructor(private readonly options: AiSafetyGateOptions) {}

  evaluateUserMessage(raw: string):
    | { blocked: false }
    | { blocked: true; pattern: string } {
    if (!this.options.safetyModeEnabled) {
      return { blocked: false };
    }
    const hay = raw.trim().toLowerCase();
    for (const p of this.options.blockedSubstrings) {
      if (p.length > 0 && hay.includes(p)) {
        return { blocked: true, pattern: p };
      }
    }
    return { blocked: false };
  }

  appendPlatformLimits(systemPrompt: string): string {
    const appendix = this.options.platformSystemAppend.trim();
    if (!appendix) {
      return systemPrompt;
    }
    return [
      systemPrompt,
      '[LIMITES_DE_SEGURANCA_DA_PLATAFORMA]',
      appendix,
    ].join('\n\n');
  }

  static fromEnvLike(config: {
    get(key: string): string | undefined;
  }): AiSafetyGate {
    const enabled = config.get('AI_SAFETY_MODE') === 'true';
    const raw = config.get('AI_SAFETY_BLOCKED_SUBSTRINGS') ?? '';
    const blockedSubstrings = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const platformSystemAppend = config.get('AI_SAFETY_SYSTEM_APPEND') ?? '';
    return new AiSafetyGate({
      safetyModeEnabled: enabled,
      blockedSubstrings,
      platformSystemAppend,
    });
  }
}
