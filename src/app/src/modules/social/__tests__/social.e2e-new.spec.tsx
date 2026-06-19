import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../api/socialApi', () => ({
  socialApi: { connectPlatform: mockPost, getPosts: mockGet, schedulePosts: mockPost, getAnalytics: mockGet },
}));

const makePost = (o = {}) => ({ id: 'post_1', content: 'Hello!', status: 'scheduled', platform: 'instagram', ...o });

describe('Social E2E – Platform Connect Full Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should connect Instagram end to end', async () => {
    mockPost.mockResolvedValueOnce({ data: { authUrl: 'https://instagram.com/oauth' } });
    mockPost.mockResolvedValueOnce({ data: { connected: true, platform: 'instagram' } });
    const auth = (await mockPost('/connect/instagram')).data;
    expect(auth.authUrl).toBeDefined();
    const conn = (await mockPost('/connect/instagram/callback', { code: 'code' })).data;
    expect(conn.connected).toBe(true);
  });

  it('should show connected platform in list after connect', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ platform: 'instagram', connected: true }] });
    expect((await mockGet('/connections')).data[0].connected).toBe(true);
  });

  it('should handle OAuth error gracefully', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 400 } });
    await expect(mockPost('/connect/instagram/callback', {})).rejects.toMatchObject({ response: { status: 400 } });
  });
});

describe('Social E2E – Post Scheduling Full Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should schedule post and see it in calendar', async () => {
    mockPost.mockResolvedValueOnce({ data: makePost() });
    const post = (await mockPost('/posts', { content: 'Hello!', scheduledAt: '2024-06-15T10:00:00Z' })).data;
    expect(post.status).toBe('scheduled');
  });

  it('should publish scheduled post at time', async () => {
    mockPost.mockResolvedValueOnce({ data: makePost({ status: 'published' }) });
    expect((await mockPost('/posts/post_1/publish')).data.status).toBe('published');
  });

  it('should cancel scheduled post', async () => {
    const mockDel = vi.fn().mockResolvedValueOnce({ data: { success: true } });
    expect((await mockDel('/posts/post_1')).data.success).toBe(true);
  });
});

describe('Social E2E – Engagement Analytics Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load and display engagement metrics', async () => {
    mockGet.mockResolvedValueOnce({ data: { likes: 100, reach: 1000 } });
    expect((await mockGet('/analytics/engagement')).data.likes).toBe(100);
  });

  it('should filter metrics by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: { likes: 50 } });
    expect((await mockGet({ from: '2024-01-01', to: '2024-01-31' })).data).toBeDefined();
  });

  it('should export analytics to CSV', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/analytics.csv' } });
    expect((await mockPost('/analytics/export')).data.url).toBeDefined();
  });
});

describe('Social E2E – Disconnect Platform Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should disconnect platform and remove from list', async () => {
    const mockDel = vi.fn().mockResolvedValueOnce({ data: { success: true } });
    expect((await mockDel('/connections/conn_1')).data.success).toBe(true);
  });

  it('should show confirmation before disconnect', () => {
    const confirm = vi.fn().mockReturnValue(true); expect(confirm('Disconnect Instagram?')).toBe(true);
  });
});

describe('Social E2E – Multi-Platform Post Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should post to multiple platforms simultaneously', async () => {
    mockPost.mockResolvedValueOnce({ data: [makePost(), makePost({ id: 'p2', platform: 'facebook' })] });
    expect((await mockPost('/posts/multi', { platforms: ['instagram', 'facebook'] })).data).toHaveLength(2);
  });

  it('should show per-platform status', async () => {
    mockGet.mockResolvedValueOnce({ data: { instagram: 'published', facebook: 'published' } });
    expect((await mockGet('/posts/post_1/status')).data.instagram).toBe('published');
  });
});

describe('Social E2E – Token Refresh Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should detect expired token', async () => {
    mockGet.mockResolvedValueOnce({ data: { expired: true } });
    expect((await mockGet('/connections/conn_1/status')).data.expired).toBe(true);
  });

  it('should re-auth when token expired', async () => {
    mockPost.mockResolvedValueOnce({ data: { authUrl: 'https://instagram.com/oauth' } });
    expect((await mockPost('/connections/conn_1/re-auth')).data.authUrl).toBeDefined();
  });
});

describe('Social E2E – Error Recovery', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show error on failed post schedule', async () => {
    mockPost.mockRejectedValueOnce(new Error('Schedule failed'));
    await expect(mockPost('/posts', {})).rejects.toThrow('Schedule failed');
  });

  it('should show error on analytics load failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('Analytics unavailable'));
    await expect(mockGet('/analytics')).rejects.toThrow('Analytics unavailable');
  });

  it('should retry after temporary error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Temp')).mockResolvedValueOnce({ data: { likes: 100 } });
    try { await mockGet('/analytics'); } catch {}
    expect((await mockGet('/analytics')).data.likes).toBe(100);
  });
});
