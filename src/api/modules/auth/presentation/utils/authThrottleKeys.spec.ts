import type { IncomingHttpHeaders } from 'http';

import type { Request } from 'express';

import {
  resolveAuthThrottleIp,
  resolveAuthThrottleDeviceId,
} from './authThrottleKeys';

function makeRequest(
  parts: Partial<Request> & { deviceId?: string },
): Request & { deviceId?: string } {
  return {
    get(name: string) {
      const h = parts.headers as IncomingHttpHeaders | undefined;
      if (!h) return undefined;
      const v = h[name.toLowerCase() as keyof IncomingHttpHeaders];
      if (Array.isArray(v)) return v.join(', ');
      return typeof v === 'string' ? v : undefined;
    },
    ...parts,
  } as unknown as Request & { deviceId?: string };
}

describe('authThrottleKeys', () => {
  describe('resolveAuthThrottleIp', () => {
    it('usa o primeiro hop de X-Forwarded-For', () => {
      const req = makeRequest({
        headers: {
          'x-forwarded-for': '203.0.113.1, 198.51.100.2',
          'user-agent': 'jest',
        },
        ip: '127.0.0.1',
      });
      expect(resolveAuthThrottleIp(req)).toBe('203.0.113.1');
    });

    it('cai em request.ip quando não há proxy header', () => {
      const req = makeRequest({
        headers: { 'user-agent': 'jest' },
        ip: '10.0.0.1',
      });
      expect(resolveAuthThrottleIp(req)).toBe('10.0.0.1');
    });
  });

  describe('resolveAuthThrottleDeviceId', () => {
    it('prioriza cookie device_id válido', () => {
      const req = makeRequest({
        cookies: {
          device_id: 'aaaaaaaaaaaaaaaa',
        },
        headers: {},
        ip: '1.2.3.4',
      });
      expect(resolveAuthThrottleDeviceId(req)).toBe('aaaaaaaaaaaaaaaa');
    });

    it('prioriza cabeçalho x-device-id sobre cookie ausente', () => {
      const req = makeRequest({
        cookies: {},
        headers: {
          'x-device-id': 'bbbbbbbbbbbbbbbb',
          'user-agent': 'ua',
        },
        ip: '1.2.3.5',
      });
      expect(resolveAuthThrottleDeviceId(req)).toBe('bbbbbbbbbbbbbbbb');
    });

    it('usa request.deviceId se já definido pelo pipeline', () => {
      const req = makeRequest({
        cookies: {},
        headers: {},
        ip: '1.1.1.1',
        deviceId: 'ccddeeffccddeeff',
      });
      expect(resolveAuthThrottleDeviceId(req)).toBe('ccddeeffccddeeff');
    });

    it('é estável quando não há cookie nem header válidos (fallback hash)', () => {
      const req = makeRequest({
        cookies: {},
        headers: { 'user-agent': 'Mozilla/5.test' },
        ip: '8.8.8.8',
      });
      const a = resolveAuthThrottleDeviceId(req);
      const b = resolveAuthThrottleDeviceId(req);
      expect(a).toBe(b);
      expect(a).toHaveLength(40);
    });

    it('recusa valores de cookie com caracteres estranhos (evita churn de Redis keys)', () => {
      const req = makeRequest({
        cookies: { device_id: 'invalid with spaces' },
        headers: { 'user-agent': 'x' },
        ip: '9.9.9.9',
      });
      const id = resolveAuthThrottleDeviceId(req);
      expect(id).not.toContain(' ');
      expect(id).toHaveLength(40);
    });
  });
});
