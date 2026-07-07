import { AISystemPromptAssembler } from '../AISystemPromptAssembler';

describe('AISystemPromptAssembler — phase context', () => {
  let assembler: AISystemPromptAssembler;
  const mockContextAggregator = {
    aggregate: jest.fn().mockResolvedValue({
      systemPrompt: 'Base prompt.',
      diagnostics: {},
    }),
  };
  const mockAgentRuleService = {
    getRule: jest.fn().mockResolvedValue(null),
  };
  const mockSafetyGate = {
    appendPlatformLimits: jest.fn((p: string) => p + '\n[LIMITS]'),
    isSafe: jest.fn().mockReturnValue({ blocked: false }),
  };

  beforeEach(() => {
    assembler = new AISystemPromptAssembler(
      mockContextAggregator as any,
      mockAgentRuleService as any,
      mockSafetyGate as any,
      undefined,
    );
  });

  const baseInput = {
    tenantId: 't1',
    conversationId: 'c1',
    userMessage: 'Olá',
    moduleId: 'messaging',
    isFirstInteraction: false,
    tenant: { id: 't1', businessType: 'ecommerce' } as any,
  };

  it('includes phase context when currentPhase is provided', async () => {
    const result = await assembler.assemble({
      ...baseInput,
      currentPhase: 'QUALIFICATION',
      businessType: 'ecommerce',
    });

    expect(result.prompt).toContain('[FASE ATUAL DA CONVERSA: QUALIFICATION]');
    expect(result.prompt).toContain('Tipo de negócio: ecommerce');
    expect(result.prompt).toContain('Faça perguntas');
  });

  it('does not include phase context when currentPhase is absent', async () => {
    const result = await assembler.assemble(baseInput);

    expect(result.prompt).not.toContain('[FASE ATUAL DA CONVERSA');
  });

  it('changes instructions based on phase', async () => {
    const greeting = await assembler.assemble({
      ...baseInput,
      currentPhase: 'GREETING',
    });
    const complaint = await assembler.assemble({
      ...baseInput,
      currentPhase: 'COMPLAINT',
    });

    expect(greeting.prompt).toContain('Cumprimente');
    expect(complaint.prompt).toContain('Escute com atenção');
  });

  it('handles unknown phase gracefully (no instructions)', async () => {
    const result = await assembler.assemble({
      ...baseInput,
      currentPhase: 'UNKNOWN_PHASE',
    });

    expect(result.prompt).toContain('[FASE ATUAL DA CONVERSA: UNKNOWN_PHASE]');
    expect(result.prompt).toContain('Inclua o campo "phase"');
  });

  it('includes niche-specific phase instructions', async () => {
    const result = await assembler.assemble({
      ...baseInput,
      currentPhase: 'DEBT_IDENTIFICATION',
      businessType: 'recovery',
    });

    expect(result.prompt).toContain('Identifique o débito');
    expect(result.prompt).toContain('Tipo de negócio: recovery');
  });
});
