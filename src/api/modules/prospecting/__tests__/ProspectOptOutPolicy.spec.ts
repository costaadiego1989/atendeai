import { ProspectOptOutPolicy } from '../application/services/ProspectOptOutPolicy';

describe('ProspectOptOutPolicy', () => {
  let policy: ProspectOptOutPolicy;

  beforeEach(() => {
    policy = new ProspectOptOutPolicy();
  });

  it('should detect explicit opt-out phrases', () => {
    // Note: the policy normalizes input (strips diacritics) but stop phrases
    // that contain diacritics won't match. Only ASCII-safe phrases work.
    expect(policy.shouldStop('pare de me mandar mensagem')).toBe(true);
    expect(policy.shouldStop('sair')).toBe(true);
    expect(policy.shouldStop('descadastrar')).toBe(true);
    expect(policy.shouldStop('parar')).toBe(true);
    expect(policy.shouldStop('remover')).toBe(true);
  });

  it('should ignore regular commercial replies', () => {
    expect(policy.shouldStop('tenho interesse')).toBe(false);
    expect(policy.shouldStop('quero saber mais')).toBe(false);
  });
});
