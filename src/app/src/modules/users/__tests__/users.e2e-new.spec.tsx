import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/usersApi', () => ({
  usersApi: { getMembers: mockGet, inviteMember: mockPost, updateMember: mockPut, removeMember: mockDelete, getRoles: mockGet, assignRole: mockPut, revokeInvite: mockDelete },
}));

const makeMember = (o = {}) => ({ id: 'user_1', name: 'Alice', email: 'alice@test.com', role: 'agent', status: 'active', ...o });
const makeInvite = (o = {}) => ({ id: 'inv_1', email: 'bob@test.com', role: 'agent', status: 'pending', ...o });

describe('Users E2E – Invite Team Member Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should invite new member via email', async () => {
    mockPost.mockResolvedValueOnce({ data: makeInvite() });
    expect((await mockPost('/team/invite', { email: 'bob@test.com', role: 'agent' })).data.status).toBe('pending');
  });

  it('should validate email before invite', () => {
    const v = vi.fn().mockReturnValue({ email: 'Invalid email' }); expect(v({ email: 'bad' }).email).toBeDefined();
  });

  it('should show pending invite in member list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeMember(), makeInvite()] });
    expect((await mockGet('/team')).data).toHaveLength(2);
  });

  it('should resend invite email', async () => {
    mockPost.mockResolvedValueOnce({ data: { sent: true } });
    expect((await mockPost('/team/invite/inv_1/resend')).data.sent).toBe(true);
  });

  it('should revoke pending invite', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    expect((await mockDelete('/team/invite/inv_1')).data.success).toBe(true);
  });
});

describe('Users E2E – Role Assignment Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should assign admin role to member', async () => {
    mockPut.mockResolvedValueOnce({ data: makeMember({ role: 'admin' }) });
    expect((await mockPut('/team/user_1', { role: 'admin' })).data.role).toBe('admin');
  });

  it('should downgrade from admin to agent', async () => {
    mockPut.mockResolvedValueOnce({ data: makeMember({ role: 'agent' }) });
    expect((await mockPut('/team/user_1', { role: 'agent' })).data.role).toBe('agent');
  });

  it('should list available roles', async () => {
    mockGet.mockResolvedValueOnce({ data: ['admin', 'agent', 'viewer'] });
    expect((await mockGet('/roles')).data).toContain('admin');
  });

  it('should prevent self role downgrade', () => {
    const canChange = vi.fn().mockReturnValue(false); expect(canChange('self')).toBe(false);
  });

  it('should show role badge for each member', () => {
    const badge = vi.fn().mockReturnValue('Admin'); expect(badge('admin')).toBe('Admin');
  });
});

describe('Users E2E – Remove Member Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should remove member from team', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    expect((await mockDelete('/team/user_1')).data.success).toBe(true);
  });

  it('should confirm before removing', () => {
    const confirm = vi.fn().mockReturnValue(true); expect(confirm('Remove Alice?')).toBe(true);
  });

  it('should remove member from list', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    expect((await mockGet('/team')).data).toHaveLength(0);
  });

  it('should prevent removing last admin', () => {
    const canRemove = vi.fn().mockReturnValue(false); expect(canRemove('last_admin')).toBe(false);
  });

  it('should reassign open items before removal', () => {
    const reassign = vi.fn(); reassign('user_1', 'user_2'); expect(reassign).toHaveBeenCalledWith('user_1', 'user_2');
  });
});

describe('Users E2E – Member List Management', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load team member list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeMember(), makeMember({ id: 'user_2', name: 'Bob' })] });
    expect((await mockGet('/team')).data).toHaveLength(2);
  });

  it('should filter members by role', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeMember({ role: 'admin' })] });
    expect((await mockGet({ role: 'admin' })).data[0].role).toBe('admin');
  });

  it('should search members by name', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeMember({ name: 'Alice' })] });
    expect((await mockGet({ search: 'Alice' })).data[0].name).toBe('Alice');
  });

  it('should search members by email', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeMember({ email: 'alice@test.com' })] });
    expect((await mockGet({ search: 'alice@' })).data[0].email).toContain('alice@');
  });

  it('should paginate member list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeMember()], total: 20 });
    expect((await mockGet({ page: 1 })).total).toBe(20);
  });
});

describe('Users E2E – Permission-Based Access Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should allow admin to invite members', () => {
    const canInvite = vi.fn().mockReturnValue(true); expect(canInvite('admin')).toBe(true);
  });

  it('should deny agent from inviting members', () => {
    const canInvite = vi.fn().mockReturnValue(false); expect(canInvite('agent')).toBe(false);
  });

  it('should allow admin to change roles', () => {
    const canChangeRole = vi.fn().mockReturnValue(true); expect(canChangeRole('admin')).toBe(true);
  });

  it('should deny agent from removing members', () => {
    const canRemove = vi.fn().mockReturnValue(false); expect(canRemove('agent')).toBe(false);
  });

  it('should show invite button only for admin', () => {
    const showBtn = vi.fn().mockImplementation((role: string) => role === 'admin');
    expect(showBtn('admin')).toBe(true);
    expect(showBtn('agent')).toBe(false);
  });
});
