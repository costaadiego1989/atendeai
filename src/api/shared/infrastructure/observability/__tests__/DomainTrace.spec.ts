import { traceSync } from '../DomainTrace';

describe('traceSync', () => {
  it('returns fn result when span starts', () => {
    expect(traceSync('billing.test.echo', {}, () => 42)).toBe(42);
  });
});
