import { AiSafetyGate } from '../application/services/AiSafetyGate';

describe('AiSafetyGate', () => {
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
});
