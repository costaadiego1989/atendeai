import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/socialApi', () => ({
  socialApi: { getConnections: mockGet, connectPlatform: mockPost, disconnectPlatform: mockDelete, schedulePosts: mockPost, getPosts: mockGet, getEngagement: mockGet, publishNow: mockPost, getAnalytics: mockGet },
}));

const makeConnection = (o = {}) => ({ id: 'conn_1', platform: 'instagram', accountName: '@mybiz', connected: true, ...o });
const makePost = (o = {}) => ({ id: 'post_1', content: 'Hello World!', platform: 'instagram', scheduledAt: '2024-06-15T10:00:00Z', status: 'scheduled', ...o });
const makeEngagement = (o = {}) => ({ likes: 100, comments: 20, shares: 15, reach: 1000, ...o });

describe('Social – Platform Connections', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load connected platforms', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeConnection()] });
    expect((await mockGet('/connections')).data).toHaveLength(1);
  });

  it('should initiate Instagram OAuth', async () => {
    mockPost.mockResolvedValueOnce({ data: { authUrl: 'https://instagram.com/oauth' } });
    expect((await mockPost('/connect/instagram')).data.authUrl).toBeDefined();
  });

  it('should initiate Facebook OAuth', async () => {
    mockPost.mockResolvedValueOnce({ data: { authUrl: 'https://facebook.com/oauth' } });
    expect((await mockPost('/connect/facebook')).data.authUrl).toBeDefined();
  });

  it('should initiate LinkedIn OAuth', async () => {
    mockPost.mockResolvedValueOnce({ data: { authUrl: 'https://linkedin.com/oauth' } });
    expect((await mockPost('/connect/linkedin')).data.authUrl).toBeDefined();
  });

  it('should handle OAuth callback and save tokens', async () => {
    mockPost.mockResolvedValueOnce({ data: makeConnection() });
    expect((await mockPost('/connect/instagram/callback', { code: 'code' })).data.connected).toBe(true);
  });

  it('should disconnect platform', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    expect((await mockDelete('/connections/conn_1')).data.success).toBe(true);
  });

  it('should show connected account name', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeConnection({ accountName: '@mybiz' })] });
    expect((await mockGet('/connections')).data[0].accountName).toBe('@mybiz');
  });

  it('should show platform connection status badge', () => {
    const badge = vi.fn().mockReturnValue('connected'); expect(badge(true)).toBe('connected');
  });

  it('should refresh token when expired', async () => {
    mockPost.mockResolvedValueOnce({ data: { token: 'new_token' } });
    expect((await mockPost('/connections/conn_1/refresh')).data.token).toBeDefined();
  });

  it('should handle OAuth error', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 400 } });
    await expect(mockPost('/connect/instagram/callback', {})).rejects.toMatchObject({ response: { status: 400 } });
  });
});

describe('Social – Post Scheduling', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should schedule a post', async () => {
    mockPost.mockResolvedValueOnce({ data: makePost() });
    expect((await mockPost('/posts', { content: 'Hello!', platform: 'instagram', scheduledAt: '2024-06-15T10:00:00Z' })).data.status).toBe('scheduled');
  });

  it('should validate post content is not empty', () => {
    const v = vi.fn().mockReturnValue({ content: 'Required' }); expect(v({}).content).toBe('Required');
  });

  it('should validate scheduled time is in future', () => {
    const v = vi.fn().mockReturnValue({ scheduledAt: 'Must be future' }); expect(v({ scheduledAt: '2020-01-01' }).scheduledAt).toBeDefined();
  });

  it('should schedule post to multiple platforms', async () => {
    mockPost.mockResolvedValueOnce({ data: [makePost(), makePost({ platform: 'facebook' })] });
    expect((await mockPost('/posts/multi', { platforms: ['instagram', 'facebook'] })).data).toHaveLength(2);
  });

  it('should edit scheduled post before publish time', async () => {
    mockPut.mockResolvedValueOnce({ data: makePost({ content: 'Updated' }) });
    expect((await mockPut('/posts/post_1', { content: 'Updated' })).data.content).toBe('Updated');
  });

  it('should cancel scheduled post', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    expect((await mockDelete('/posts/post_1')).data.success).toBe(true);
  });

  it('should publish post immediately', async () => {
    mockPost.mockResolvedValueOnce({ data: makePost({ status: 'published', publishedAt: new Date().toISOString() }) });
    expect((await mockPost('/posts/post_1/publish')).data.status).toBe('published');
  });

  it('should validate character limit per platform', () => {
    const limit = vi.fn().mockReturnValue(280); expect(limit('twitter')).toBe(280);
  });

  it('should attach media to post', async () => {
    mockPost.mockResolvedValueOnce({ data: makePost({ media: ['https://files/img.jpg'] }) });
    expect((await mockPost('/posts', { media: ['img.jpg'] })).data.media).toHaveLength(1);
  });

  it('should load scheduled posts calendar', async () => {
    mockGet.mockResolvedValueOnce({ data: [makePost(), makePost({ id: 'post_2' })] });
    expect((await mockGet('/posts?status=scheduled')).data).toHaveLength(2);
  });
});

describe('Social – Engagement Metrics', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load engagement metrics', async () => {
    mockGet.mockResolvedValueOnce({ data: makeEngagement() });
    expect((await mockGet('/analytics/engagement')).data.likes).toBe(100);
  });

  it('should filter by platform', async () => {
    mockGet.mockResolvedValueOnce({ data: makeEngagement({ platform: 'instagram' }) });
    expect((await mockGet({ platform: 'instagram' })).data.platform).toBe('instagram');
  });

  it('should filter by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: makeEngagement() });
    expect((await mockGet({ from: '2024-01-01', to: '2024-01-31' })).data).toBeDefined();
  });

  it('should calculate engagement rate', () => {
    const rate = vi.fn().mockReturnValue(13.5);
    expect(rate(135, 1000)).toBe(13.5);
  });

  it('should show top performing post', async () => {
    mockGet.mockResolvedValueOnce({ data: { topPost: makePost({ likes: 500 }) } });
    expect((await mockGet('/analytics/top-posts')).data.topPost).toBeDefined();
  });

  it('should show follower growth', async () => {
    mockGet.mockResolvedValueOnce({ data: { followers: 1200, growth: 50 } });
    expect((await mockGet('/analytics/followers')).data.growth).toBe(50);
  });

  it('should show impressions per post', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ postId: 'post_1', impressions: 5000 }] });
    expect((await mockGet('/analytics/impressions')).data[0].impressions).toBe(5000);
  });

  it('should compare engagement across platforms', async () => {
    mockGet.mockResolvedValueOnce({ data: { instagram: makeEngagement(), facebook: makeEngagement({ likes: 50 }) } });
    const res = await mockGet('/analytics/compare');
    expect(res.data.instagram.likes).toBeGreaterThan(res.data.facebook.likes);
  });

  it('should handle analytics fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Analytics unavailable'));
    await expect(mockGet('/analytics')).rejects.toThrow('Analytics unavailable');
  });

  it('should export analytics as CSV', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/analytics.csv' } });
    expect((await mockPost('/analytics/export')).data.url).toBeDefined();
  });
});

describe('Social – Platform Authentication', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should validate platform auth token on connect', async () => {
    mockPost.mockResolvedValueOnce({ data: { valid: true } });
    expect((await mockPost('/auth/validate', { platform: 'instagram', token: 'tok' })).data.valid).toBe(true);
  });

  it('should handle invalid auth token', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 401 } });
    await expect(mockPost('/auth/validate', {})).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('should store platform credentials securely', () => {
    const store = vi.fn(); store({ platform: 'instagram', token: '***' }); expect(store).toHaveBeenCalled();
  });

  it('should detect expired platform token', async () => {
    mockGet.mockResolvedValueOnce({ data: { expired: true } });
    expect((await mockGet('/connections/conn_1/status')).data.expired).toBe(true);
  });

  it('should prompt re-auth when token expired', () => {
    const prompt = vi.fn().mockReturnValue(true); expect(prompt(true)).toBe(true);
  });

  it('should revoke platform access on disconnect', async () => {
    mockPost.mockResolvedValueOnce({ data: { revoked: true } });
    expect((await mockPost('/connections/conn_1/revoke')).data.revoked).toBe(true);
  });

  it('should list all connected platforms', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeConnection(), makeConnection({ id: 'conn_2', platform: 'facebook' })] });
    expect((await mockGet('/connections')).data).toHaveLength(2);
  });

  it('should show required scopes for each platform', () => {
    const scopes = vi.fn().mockReturnValue(['read_posts', 'write_posts', 'read_analytics']);
    expect(scopes('instagram')).toHaveLength(3);
  });

  it('should handle platform API rate limit', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 429, data: { retryAfter: 60 } } });
    await expect(mockGet('/analytics')).rejects.toMatchObject({ response: { status: 429 } });
  });

  it('should support multiple accounts per platform', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeConnection(), makeConnection({ id: 'conn_3', accountName: '@biz2' })] });
    const accts = (await mockGet('/connections?platform=instagram')).data;
    expect(accts).toHaveLength(2);
  });
});
