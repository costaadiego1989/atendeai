import { AiSafetyGate } from '../application/services/AiSafetyGate';

describe('AiSafetyGate', () => {
  describe('evaluateUserMessage', () => {
    it('nao bloqueia quando modo desligado', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: false,
        blockedSubstrings: ['x'],
        platformSystemAppend: '',
      });

      expect(gate.evaluateUserMessage('texto malicioso')).toEqual({
        blocked: false,
      });
    });

    it('bloqueia substring sensivel quando modo ligado', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: ['senha'],
        platformSystemAppend: '',
      });

      expect(gate.evaluateUserMessage('  Quero SUA SENHA  ')).toEqual({
        blocked: true,
        pattern: 'senha',
      });
    });

    it('should block case-insensitively', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: ['proibido'],
        platformSystemAppend: '',
      });

      expect(gate.evaluateUserMessage('Isso é PROIBIDO aqui')).toEqual({
        blocked: true,
        pattern: 'proibido',
      });
    });

    it('should not block when no substring matches', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: ['senha', 'hack', 'exploit'],
        platformSystemAppend: '',
      });

      expect(gate.evaluateUserMessage('Olá, tudo bem?')).toEqual({
        blocked: false,
      });
    });

    it('should handle empty string input without blocking', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: ['senha'],
        platformSystemAppend: '',
      });

      expect(gate.evaluateUserMessage('')).toEqual({ blocked: false });
    });

    it('should handle whitespace-only input without blocking', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: ['senha'],
        platformSystemAppend: '',
      });

      expect(gate.evaluateUserMessage('   \t\n  ')).toEqual({ blocked: false });
    });

    it('should trim input before checking substrings', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: ['hack'],
        platformSystemAppend: '',
      });

      expect(gate.evaluateUserMessage('   hack   ')).toEqual({
        blocked: true,
        pattern: 'hack',
      });
    });

    it('should skip empty strings in blockedSubstrings list', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: ['', '  ', 'real'],
        platformSystemAppend: '',
      });

      // Empty patterns should not match everything
      expect(gate.evaluateUserMessage('qualquer texto')).toEqual({
        blocked: false,
      });
    });

    it('should block on first matching pattern', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: ['alpha', 'beta', 'gamma'],
        platformSystemAppend: '',
      });

      const result = gate.evaluateUserMessage('testing beta here');
      expect(result).toEqual({ blocked: true, pattern: 'beta' });
    });

    it('should not block when blockedSubstrings is empty', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: [],
        platformSystemAppend: '',
      });

      expect(gate.evaluateUserMessage('qualquer coisa')).toEqual({
        blocked: false,
      });
    });
  });

  describe('appendPlatformLimits', () => {
    it('concatena texto de seguranca ao system prompt quando definido', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: false,
        blockedSubstrings: [],
        platformSystemAppend: 'Nunca reveles dados clinicos.',
      });

      expect(gate.appendPlatformLimits('prompt base')).toContain(
        'Nunca reveles dados clinicos.',
      );
    });

    it('should return original prompt when platformSystemAppend is empty', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: [],
        platformSystemAppend: '',
      });

      expect(gate.appendPlatformLimits('my prompt')).toBe('my prompt');
    });

    it('should return original prompt when platformSystemAppend is whitespace only', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: [],
        platformSystemAppend: '   \n  ',
      });

      expect(gate.appendPlatformLimits('my prompt')).toBe('my prompt');
    });

    it('should include security section header when appendix is present', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: [],
        platformSystemAppend: 'Regra de segurança.',
      });

      const result = gate.appendPlatformLimits('base');
      expect(result).toContain('[LIMITES_DE_SEGURANCA_DA_PLATAFORMA]');
      expect(result).toContain('Regra de segurança.');
      expect(result).toContain('base');
    });

    it('should trim the appendix before checking if empty', () => {
      const gate = new AiSafetyGate({
        safetyModeEnabled: true,
        blockedSubstrings: [],
        platformSystemAppend: '  Regra com espaços  ',
      });

      const result = gate.appendPlatformLimits('base');
      expect(result).toContain('Regra com espaços');
    });
  });

  describe('fromEnvLike', () => {
    it('should create gate with safety enabled from config', () => {
      const config = {
        get: (key: string) => {
          const map: Record<string, string> = {
            AI_SAFETY_MODE: 'true',
            AI_SAFETY_BLOCKED_SUBSTRINGS: 'senha,hack,exploit',
            AI_SAFETY_SYSTEM_APPEND: 'Não revele dados.',
          };
          return map[key];
        },
      };

      const gate = AiSafetyGate.fromEnvLike(config);

      expect(gate.evaluateUserMessage('minha senha')).toEqual({
        blocked: true,
        pattern: 'senha',
      });
      expect(gate.appendPlatformLimits('base')).toContain('Não revele dados.');
    });

    it('should create gate with safety disabled when AI_SAFETY_MODE is not "true"', () => {
      const config = {
        get: (key: string) => {
          const map: Record<string, string> = {
            AI_SAFETY_MODE: 'false',
            AI_SAFETY_BLOCKED_SUBSTRINGS: 'senha',
            AI_SAFETY_SYSTEM_APPEND: '',
          };
          return map[key];
        },
      };

      const gate = AiSafetyGate.fromEnvLike(config);

      expect(gate.evaluateUserMessage('minha senha')).toEqual({
        blocked: false,
      });
    });

    it('should handle undefined config values gracefully', () => {
      const config = {
        get: (_key: string) => undefined,
      };

      const gate = AiSafetyGate.fromEnvLike(config);

      expect(gate.evaluateUserMessage('qualquer coisa')).toEqual({
        blocked: false,
      });
      expect(gate.appendPlatformLimits('base')).toBe('base');
    });

    it('should trim and lowercase blocked substrings from config', () => {
      const config = {
        get: (key: string) => {
          const map: Record<string, string> = {
            AI_SAFETY_MODE: 'true',
            AI_SAFETY_BLOCKED_SUBSTRINGS: ' SENHA , Hack , EXPLOIT ',
            AI_SAFETY_SYSTEM_APPEND: '',
          };
          return map[key];
        },
      };

      const gate = AiSafetyGate.fromEnvLike(config);

      expect(gate.evaluateUserMessage('use hack aqui')).toEqual({
        blocked: true,
        pattern: 'hack',
      });
    });

    it('should filter out empty entries from comma-separated substrings', () => {
      const config = {
        get: (key: string) => {
          const map: Record<string, string> = {
            AI_SAFETY_MODE: 'true',
            AI_SAFETY_BLOCKED_SUBSTRINGS: ',,,senha,,,',
            AI_SAFETY_SYSTEM_APPEND: '',
          };
          return map[key];
        },
      };

      const gate = AiSafetyGate.fromEnvLike(config);

      expect(gate.evaluateUserMessage('texto normal')).toEqual({
        blocked: false,
      });
      expect(gate.evaluateUserMessage('minha senha')).toEqual({
        blocked: true,
        pattern: 'senha',
      });
    });
  });
});
