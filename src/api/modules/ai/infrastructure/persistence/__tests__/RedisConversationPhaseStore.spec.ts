import { RedisConversationPhaseStore } from '../RedisConversationPhaseStore';

describe('RedisConversationPhaseStore', () => {
  let store: RedisConversationPhaseStore;
  let mockRedis: Record<string, jest.Mock>;
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    mockRedis = {
      get: jest.fn(async (key: string) => storage.get(key) ?? null),
      set: jest.fn(
        async (key: string, value: string, _ex: string, _ttl: number) => {
          storage.set(key, value);
          return 'OK';
        },
      ),
    };
    store = new RedisConversationPhaseStore(mockRedis as any);
  });

  describe('get()', () => {
    it('returns GREETING for new conversation', async () => {
      const state = await store.get('conv-new');

      expect(state.currentPhase).toBe('GREETING');
      expect(state.businessType).toBe('generic');
      expect(state.history).toHaveLength(0);
    });

    it('returns persisted state', async () => {
      await store.set('conv-1', 'QUALIFICATION', 'ecommerce');
      const state = await store.get('conv-1');

      expect(state.currentPhase).toBe('QUALIFICATION');
      expect(state.businessType).toBe('ecommerce');
    });

    it('returns default on corrupt data', async () => {
      storage.set('conv_phase:conv-bad', 'not-json{{');
      const state = await store.get('conv-bad');

      expect(state.currentPhase).toBe('GREETING');
    });
  });

  describe('set()', () => {
    it('persists phase and businessType', async () => {
      await store.set('conv-1', 'SCHEDULING', 'clinic');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'conv_phase:conv-1',
        expect.any(String),
        'EX',
        expect.any(Number),
      );

      const state = await store.get('conv-1');
      expect(state.currentPhase).toBe('SCHEDULING');
      expect(state.businessType).toBe('clinic');
    });
  });

  describe('transition()', () => {
    it('valid transition updates phase and returns true', async () => {
      await store.set('conv-1', 'GREETING', 'ecommerce');

      const result = await store.transition(
        'conv-1',
        'QUALIFICATION',
        'ecommerce',
      );

      expect(result).toBe(true);
      const state = await store.get('conv-1');
      expect(state.currentPhase).toBe('QUALIFICATION');
    });

    it('invalid transition returns false and keeps old phase', async () => {
      await store.set('conv-1', 'GREETING', 'ecommerce');

      const result = await store.transition(
        'conv-1',
        'CHECKOUT',
        'ecommerce',
      );

      expect(result).toBe(false);
      const state = await store.get('conv-1');
      expect(state.currentPhase).toBe('GREETING');
    });

    it('invalid phase for niche returns false', async () => {
      await store.set('conv-1', 'GREETING', 'clinic');

      const result = await store.transition(
        'conv-1',
        'CHECKOUT',
        'clinic',
      );

      expect(result).toBe(false);
    });

    it('tracks transition history', async () => {
      await store.set('conv-1', 'GREETING', 'ecommerce');
      await store.transition('conv-1', 'QUALIFICATION', 'ecommerce');
      await store.transition('conv-1', 'PRODUCT_DISCOVERY', 'ecommerce');

      const state = await store.get('conv-1');
      expect(state.history).toHaveLength(2);
      expect(state.history[0].from).toBe('GREETING');
      expect(state.history[0].to).toBe('QUALIFICATION');
      expect(state.history[1].from).toBe('QUALIFICATION');
      expect(state.history[1].to).toBe('PRODUCT_DISCOVERY');
      expect(state.history[0].timestamp).toBeDefined();
    });

    it('limits history to last N entries', async () => {
      await store.set('conv-1', 'GREETING', 'generic');

      // Do 25 valid transitions cycling between GREETING and SUPPORT via COMPLAINT
      const phases = ['COMPLAINT', 'SUPPORT', 'GREETING'];
      let current = 'GREETING';
      for (let i = 0; i < 25; i++) {
        const next = phases[i % phases.length];
        await store.transition('conv-1', next, 'generic');
        current = next;
      }

      const state = await store.get('conv-1');
      expect(state.history.length).toBeLessThanOrEqual(20);
    });

    it('same phase → same phase returns true (stay)', async () => {
      await store.set('conv-1', 'QUALIFICATION', 'ecommerce');

      const result = await store.transition(
        'conv-1',
        'QUALIFICATION',
        'ecommerce',
      );

      expect(result).toBe(true);
    });

    it('works with clinic niche transitions', async () => {
      await store.set('conv-1', 'GREETING', 'clinic');

      expect(
        await store.transition('conv-1', 'SCHEDULING', 'clinic'),
      ).toBe(true);
      expect(
        await store.transition('conv-1', 'CONFIRMATION', 'clinic'),
      ).toBe(true);

      const state = await store.get('conv-1');
      expect(state.currentPhase).toBe('CONFIRMATION');
    });
  });
});
