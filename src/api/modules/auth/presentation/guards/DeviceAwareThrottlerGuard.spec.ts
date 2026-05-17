import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { DeviceAwareThrottlerGuard } from './DeviceAwareThrottlerGuard';

describe('DeviceAwareThrottlerGuard', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origThrottleLimit = process.env.AUTH_THROTTLE_LIMIT;
  let store: Record<string, number>;

  beforeEach(() => {
    store = {};
    process.env.NODE_ENV = 'staging';
  });

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    if (origThrottleLimit === undefined) {
      delete process.env.AUTH_THROTTLE_LIMIT;
    } else {
      process.env.AUTH_THROTTLE_LIMIT = origThrottleLimit;
    }
  });

  function redisMock(): {
    incr: jest.Mock;
    expire: jest.Mock;
  } {
    return {
      incr: jest.fn(async (key: string) => {
        store[key] = (store[key] ?? 0) + 1;
        return store[key];
      }),
      expire: jest.fn(async () => 1),
    };
  }

  function makeContext(req: Partial<Request>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req as Request,
      }),
    } as ExecutionContext;
  }

  it('bloqueia após ultrapassar o limite no IP', async () => {
    process.env.AUTH_THROTTLE_LIMIT = '2';

    const guard = new DeviceAwareThrottlerGuard(
      redisMock() as unknown as import('ioredis').default,
    );
    const ctx = makeContext({
      method: 'POST',
      path: '/auth/refresh',
      route: {
        path: '/auth/refresh',
      } as unknown as NonNullable<Request['route']>,
      cookies: {},
      headers: { 'user-agent': 'Mozilla/x' },
      ip: '10.90.90.90',
      get(header: string) {
        return header.toLowerCase() === 'user-agent' ? 'Mozilla/x' : undefined;
      },
    } as unknown as Partial<Request>);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 429 });
  });

  it('em NODE_ENV=test deixa passar sem contar Redis', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_THROTTLE_LIMIT = '1';

    const mock = redisMock();
    const guard = new DeviceAwareThrottlerGuard(
      mock as unknown as import('ioredis').default,
    );
    const ctx = makeContext({ method: 'POST', path: '/auth/login' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(mock.incr).not.toHaveBeenCalled();
  });
});
