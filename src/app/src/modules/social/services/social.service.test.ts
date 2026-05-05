import { describe, it, expect, vi, beforeEach } from 'vitest';
import { socialService } from './social.service';

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    delete: vi.fn(),
    put: vi.fn(),
  },
}));

describe('socialService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envia payload de criação de regra para endpoint correto', async () => {
    postMock.mockResolvedValue({ id: 'rule-1' });

    await socialService.createRule('tenant-1', {
      name: 'Regra Preço',
      platform: 'INSTAGRAM',
      priority: 10,
      conditions: { keywords: ['preço'] },
      actions: {
        replyToComment: { enabled: true, mode: 'AI_GENERATED' },
        sendInboxMessage: { enabled: true, delaySeconds: 20, mode: 'TEMPLATE' },
      },
      limits: { maxRepliesPerPost: 50, maxRepliesPerHour: 30, cooldownPerUser: 60 },
    });

    expect(postMock).toHaveBeenCalledWith(
      '/tenants/tenant-1/social/rules',
      expect.objectContaining({
        name: 'Regra Preço',
        conditions: { keywords: ['preço'] },
      }),
    );
  });

  it('consulta comentários no endpoint de social comments', async () => {
    getMock.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    await socialService.listComments('tenant-1', { page: 1, limit: 20 });
    expect(getMock).toHaveBeenCalledWith('/tenants/tenant-1/social/comments', {
      page: 1,
      limit: 20,
    });
  });
});

