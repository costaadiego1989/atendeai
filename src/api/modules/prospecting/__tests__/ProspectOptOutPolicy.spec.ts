import { ProspectOptOutPolicy } from '../application/services/ProspectOptOutPolicy';

describe('ProspectOptOutPolicy', () => {
  let policy: ProspectOptOutPolicy;

  beforeEach(() => {
    policy = new ProspectOptOutPolicy();
  });

  it('should detect explicit opt-out phrases', () => {
    expect(policy.shouldStop('pare de me mandar mensagem')).toBe(true);
    expect(policy.shouldStop('não quero mais receber')).toBe(true);
    expect(policy.shouldStop('sair')).toBe(true);
  });

  it('should ignore regular commercial replies', () => {
    expect(policy.shouldStop('tenho interesse')).toBe(false);
    expect(policy.shouldStop('quero saber mais')).toBe(false);
  });
});
