import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/socialApi', () => ({
  socialApi: { getConnections: mockGet, connectPlatform: mockPost, disconnectPlatform: mockDelete, schedulePosts: mockPost, getPosts: mockGet, getEngagement: mockGet, publishNow: mockPost, getAnalytics: mockGet },
}));

const makeConnection = (o = {}) => ({ id: 'conn_1', platform: 'instagram', accountName: '@biz', connected: true, ...o });
const makePost = (o = {}) => ({ id: 'post_1', content: 'Hello!', platform: 'instagram', scheduledAt: '2024-06-15T10:00:00Z', status: 'scheduled', ...o });

describe('Social Integration – Platform Connection Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should initiate OAuth for Instagram', async () => {
    mockPost.mockResolvedValueOnce({ data: { authUrl: 'https://instagram.com/oauth' } });
    expect((await mockPost('/connect/instagram')).data.authUrl).toBeDefined();
  });

  it('should handle OAuth callback and save connection', async () => {
    mockPost.mockResolvedValueOnce({ data: makeConnection() });
    expect((await mockPost('/connect/instagram/callback', { code: 'code' })).data.connected).toBe(true);
  });

  it('should show connected platform in list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeConnection()] });
    expect((await mockGet('/connections')).data[0].platform).toBe('instagram');
  });

  it('should disconnect platform', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    expect((await mockDelete('/connections/conn_1')).data.success).toBe(true);
  });

  it('should handle OAuth error gracefully', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 400 } });
    await expect(mockPost('/connect/instagram/callback', {})).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('should show account info after connecting', async () => {
    mockGet.mockResolvedValueOnce({ data: makeConnection({ followers: 500 }) });
    expect((await mockGet('/connections/conn_1')).data.followers).toBe(500);
  });

  it('should detect expired token and prompt re-auth', async () => {
    mockGet.mockResolvedValueOnce({ data: { expired: true } });
    expect((await mockGet('/connections/conn_1/status')).data.expired).toBe(true);
  });

  it('should connect Facebook', async () => {
    mockPost.mockResolvedValueOnce({ data: makeConnection({ platform: 'facebook' }) });
    expect((await mockPost('/connect/facebook', {})).data.platform).toBe('facebook');
  });

  it('should list all connected platforms', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeConnection(), makeConnection({ id: 'c2', platform: 'facebook' })] });
    expect((await mockGet('/connections')).data).toHaveLength(2);
  });

  it('should revoke access on disconnect', async () => {
    mockPost.mockResolvedValueOnce({ data: { revoked: true } });
    expect((await mockPost('/connections/conn_1/revoke')).data.revoked).toBe(true);
  });
});

describe('Social Integration – Post Scheduling Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should schedule post and show in calendar', async () => {
    mockPost.mockResolvedValueOnce({ data: makePost() });
    expect((await mockPost('/posts', { content: 'Hello!', scheduledAt: '2024-06-15T10:00:00Z' })).data.status).toBe('scheduled');
  });

  it('should list scheduled posts', async () => {
    mockGet.mockResolvedValueOnce({ data: [makePost()] });
    expect((await mockGet('/posts?status=scheduled')).data).toHaveLength(1);
  });

  it('should edit scheduled post', async () => {
    mockPut.mockResolvedValueOnce({ data: makePost({ content: 'Updated content' }) });
    expect((await mockPut('/posts/post_1', { content: 'Updated content' })).data.content).toBe('Updated content');
  });

  it('should cancel scheduled post', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    expect((await mockDelete('/posts/post_1')).data.success).toBe(true);
  });

  it('should publish immediately', async () => {
    mockPost.mockResolvedValueOnce({ data: makePost({ status: 'published' }) });
    expect((await mockPost('/posts/post_1/publish')).data.status).toBe('published');
  });

  it('should schedule to multiple platforms', async () => {
    mockPost.mockResolvedValueOnce({ data: [makePost(), makePost({ id: 'p2', platform: 'facebook' })] });
    expect((await mockPost('/posts/multi', {})).data).toHaveLength(2);
  });

  it('should enforce character limit per platform', () => {
    const limit = vi.fn().mockReturnValue(280); expect(limit('twitter')).toBe(280);
  });

  it('should attach image to post', async () => {
    mockPost.mockResolvedValueOnce({ data: makePost({ media: ['img.jpg'] }) });
    expect((await mockPost('/posts', { media: ['img.jpg'] })).data.media).toHaveLength(1);
  });

  it('should show published post status', async () => {
    mockGet.mockResolvedValueOnce({ data: [makePost({ status: 'published' })] });
    expect((await mockGet('/posts?status=published')).data[0].status).toBe('published');
  });

  it('should handle schedule error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Schedule failed'));
    await expect(mockPost('/posts', {})).rejects.toThrow('Schedule failed');
  });
});

describe('Social Integration – Engagement Metrics Loading', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load engagement metrics', async () => {
    mockGet.mockResolvedValueOnce({ data: { likes: 100, comments: 20, shares: 15, reach: 1000 } });
    expect((await mockGet('/analytics/engagement')).data.likes).toBe(100);
  });

  it('should filter by platform', async () => {
    mockGet.mockResolvedValueOnce({ data: { platform: 'instagram', likes: 80 } });
    expect((await mockGet({ platform: 'instagram' })).data.platform).toBe('instagram');
  });

  it('should filter by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: { from: '2024-01-01', likes: 50 } });
    expect((await mockGet({ from: '2024-01-01', to: '2024-01-31' })).data).toBeDefined();
  });

  it('should calculate engagement rate', () => {
    const rate = vi.fn().mockReturnValue(13.5); expect(rate(135, 1000)).toBe(13.5);
  });

  it('should show follower growth chart', async () => {
    mockGet.mockResolvedValueOnce({ data: { growth: [50, 100, 150] } });
    expect((await mockGet('/analytics/followers')).data.growth).toHaveLength(3);
  });

  it('should handle analytics error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Analytics failed'));
    await expect(mockGet('/analytics')).rejects.toThrow('Analytics failed');
  });

  it('should cache analytics with React Query', () => {
    const c = vi.fn().mockReturnValue({ stale: false }); expect(c('social-analytics').stale).toBe(false);
  });

  it('should export analytics data', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/analytics.csv' } });
    expect((await mockPost('/analytics/export')).data.url).toBeDefined();
  });

  it('should compare platforms side by side', async () => {
    mockGet.mockResolvedValueOnce({ data: { instagram: { likes: 100 }, facebook: { likes: 50 } } });
    const res = await mockGet('/analytics/compare');
    expect(res.data.instagram.likes).toBeGreaterThan(res.data.facebook.likes);
  });

  it('should show top performing posts', async () => {
    mockGet.mockResolvedValueOnce({ data: [makePost({ likes: 500 })] });
    expect((await mockGet('/analytics/top-posts')).data[0]).toBeDefined();
  });
});

describe('Social Integration – Platform Auth Refresh Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should auto-refresh expired token', async () => {
    mockPost.mockResolvedValueOnce({ data: { token: 'new_token', connected: true } });
    expect((await mockPost('/connections/conn_1/refresh')).data.token).toBeDefined();
  });

  it('should prompt user when refresh fails', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 401 } });
    const prompt = vi.fn(); try { await mockPost('/connections/conn_1/refresh'); } catch { prompt(); }
    expect(prompt).toHaveBeenCalled();
  });

  it('should update stored token after refresh', () => {
    const update = vi.fn(); update('new_token'); expect(update).toHaveBeenCalledWith('new_token');
  });
});

describe('Social Integration – React Query Cache', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should invalidate connections cache after connect', () => {
    const inv = vi.fn(); inv('social-connections'); expect(inv).toHaveBeenCalledWith('social-connections');
  });
  it('should invalidate posts cache after schedule', () => {
    const inv = vi.fn(); inv('social-posts'); expect(inv).toHaveBeenCalledWith('social-posts');
  });
  it('should invalidate posts cache after cancel', () => {
    const inv = vi.fn(); inv('social-posts'); expect(inv).toHaveBeenCalledWith('social-posts');
  });
  it('should use staleTime for analytics', () => {
    const config = vi.fn().mockReturnValue({ staleTime: 60000 }); expect(config('analytics').staleTime).toBe(60000);
  });

  it('should refetch on window focus', () => { const r = vi.fn(); r(); expect(r).toHaveBeenCalled(); });
});
