import { RecoveryReplyPolicy } from '../application/services/RecoveryReplyPolicy';

describe('RecoveryReplyPolicy', () => {
  let sut: RecoveryReplyPolicy;

  beforeEach(() => {
    sut = new RecoveryReplyPolicy();
  });

  it('should classify opt-out phrases as STOPPED', () => {
    expect(sut.classify('pare de me mandar mensagem')).toBe('STOPPED');
    expect(sut.classify('quero sair dessa lista')).toBe('STOPPED');
  });

  it('should classify payment promises as PROMISE_TO_PAY', () => {
    expect(sut.classify('vou pagar hoje no pix')).toBe('PROMISE_TO_PAY');
    expect(sut.classify('amanhã eu pago')).toBe('PROMISE_TO_PAY');
  });

  it('should classify generic recovery replies as NEGOTIATING', () => {
    expect(sut.classify('consigo parcelar isso?')).toBe('NEGOTIATING');
    expect(sut.classify('me explica melhor esse valor')).toBe('NEGOTIATING');
  });
});
