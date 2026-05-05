import { StructuredLogEmitter } from '../StructuredLogEmitter';

describe('StructuredLogEmitter', () => {
  it('buildJsonLine includes required keys', () => {
    const line = StructuredLogEmitter.buildJsonLine({
      level: 'info',
      event: 'test.event',
      message: 'hello',
      attributes: { k: 'v' },
      traceId: 'abc',
      spanId: 'def',
    });
    const o = JSON.parse(line) as Record<string, unknown>;
    expect(o['@timestamp']).toBeDefined();
    expect(o['level']).toBe('info');
    expect(o['event']).toBe('test.event');
    expect(o['trace_id']).toBe('abc');
    expect(o['span_id']).toBe('def');
    expect((o['attributes'] as Record<string, string>).k).toBe('v');
  });
});
