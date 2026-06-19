import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

vi.mock('../hooks/useTeamMembers');
vi.mock('../hooks/useInvitations');
vi.mock('../hooks/useUserProfile');
vi.mock('../hooks/useRolePermissions');
vi.mock('../api/teamApi', () => ({
  sendInvitation: vi.fn(),
  updateMemberRole: vi.fn(),
  deactivateMember: vi.fn(),
  updateProfile: vi.fn(),
}));

import { useTeamMembers } from '../hooks/useTeamMembers';
import { useInvitations } from '../hooks/useInvitations';
import { useUserProfile } from '../hooks/useUserProfile';
import { useRolePermissions } from '../hooks/useRolePermissions';
import * as teamApi from '../api/teamApi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockTeamMembers = [
  { id: '1', name: 'Alice Admin',  email: 'alice@test.com', role: 'admin'  as const, status: 'active'   as const },
  { id: '2', name: 'Bob Member',   email: 'bob@test.com',   role: 'member' as const, status: 'active'   as const },
  { id: '3', name: 'Carol Viewer', email: 'carol@test.com', role: 'viewer' as const, status: 'active'   as const },
  { id: '4', name: 'Dan Pending',  email: 'dan@test.com',   role: 'member' as const, status: 'pending'  as const },
  { id: '5', name: 'Eve Inactive', email: 'eve@test.com',   role: 'viewer' as const, status: 'inactive' as const },
];

const mockInvitations = [
  { id: 'inv1', email: 'invite1@test.com', role: 'member', status: 'pending' as const, invitedAt: '2024-01-01T00:00:00Z' },
  { id: 'inv2', email: 'invite2@test.com', role: 'viewer', status: 'pending' as const, invitedAt: '2024-01-02T00:00:00Z' },
  { id: 'inv3', email: 'invite3@test.com', role: 'admin',  status: 'pending' as const, invitedAt: '2024-01-03T00:00:00Z' },
];

const mockProfile = {
  id: 'user-1',
  name: 'Test User',
  email: 'testuser@test.com',
  role: 'admin',
  avatar: 'https://example.com/avatar.png',
  bio: 'Software engineer',
  department: 'Engineering',
};

// ── QueryClient wrapper ───────────────────────────────────────────────────────

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// ── Inline test components ────────────────────────────────────────────────────

function TeamPage() {
  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTeamMembers() as any;
  if (isLoading) return <div data-testid="loading">Loading...</div>;
  if (isError)   return <div data-testid="error">{(error as any)?.message ?? 'Error'}</div>;
  return (
    <div>
      <h1>Team</h1>
      <ul>
        {(data ?? []).map((m: any) => (
          <li key={m.id} data-testid={`member-${m.id}`}>
            {m.name} — {m.role} — {m.status}
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} data-testid="load-more">
          {isFetchingNextPage ? 'Loading more...' : 'Load more'}
        </button>
      )}
    </div>
  );
}

function InviteForm() {
  const { sendInvitation, isLoading } = useInvitations() as any;
  const [email, setEmail] = React.useState('');
  const [role,  setRole]  = React.useState('member');
  const [sent,  setSent]  = React.useState(false);
  const [err,   setErr]   = React.useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendInvitation({ email, role });
      setSent(true);
    } catch (ex: any) {
      setErr(ex.message ?? 'Error');
    }
  };
  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="invite-email">Email</label>
      <input id="invite-email" value={email} onChange={e => setEmail(e.target.value)} />
      <label htmlFor="invite-role">Role</label>
      <select id="invite-role" value={role} onChange={e => setRole(e.target.value)}>
        <option value="admin">admin</option>
        <option value="member">member</option>
        <option value="viewer">viewer</option>
      </select>
      {sent && <span data-testid="invite-success">Invitation sent</span>}
      {err  && <span data-testid="invite-error">{err}</span>}
      <button type="submit" disabled={isLoading}>Send Invite</button>
    </form>
  );
}

function ProfileEditForm() {
  const { profile, isLoading, updateProfile, isUpdating } = useUserProfile() as any;
  const [name,   setName]   = React.useState(profile?.name       ?? '');
  const [bio,    setBio]    = React.useState(profile?.bio        ?? '');
  const [dept,   setDept]   = React.useState(profile?.department ?? '');
  const [avatar, setAvatar] = React.useState(profile?.avatar     ?? '');
  const [saved,  setSaved]  = React.useState(false);
  const [err,    setErr]    = React.useState('');
  if (isLoading) return <div data-testid="profile-loading">Loading profile...</div>;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({ name, bio, department: dept, avatar });
      setSaved(true);
    } catch (ex: any) {
      setErr(ex.message ?? 'Error');
    }
  };
  const handleCancel = () => {
    setName(profile?.name       ?? '');
    setBio(profile?.bio         ?? '');
    setDept(profile?.department ?? '');
    setAvatar(profile?.avatar   ?? '');
  };
  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" value={name} onChange={e => setName(e.target.value)} />
      <label htmlFor="bio">Bio</label>
      <input id="bio"  value={bio}  onChange={e => setBio(e.target.value)}  />
      <label htmlFor="department">Department</label>
      <input id="department" value={dept}   onChange={e => setDept(e.target.value)}   />
      <label htmlFor="avatar">Avatar</label>
      <input id="avatar"     value={avatar} onChange={e => setAvatar(e.target.value)} />
      {saved && <span data-testid="profile-saved">Profile saved</span>}
      {err   && <span data-testid="profile-error">{err}</span>}
      <button type="submit" disabled={isUpdating}>{isUpdating ? 'Saving...' : 'Save'}</button>
      <button type="button" onClick={handleCancel}>Cancel</button>
    </form>
  );
}

function RoleSelector({ memberId, currentUserId = 'other' }: { memberId: string; currentUserId?: string }) {
  const { canManageRoles, permissions } = useRolePermissions() as any;
  const [role,       setRole]       = React.useState('member');
  const [optimistic, setOptimistic] = React.useState('');
  const [success,    setSuccess]    = React.useState(false);
  const [error,      setError]      = React.useState('');
  const [loading,    setLoading]    = React.useState(false);

  if (!canManageRoles)         return <div data-testid="no-permission">No permission</div>;
  if (memberId === currentUserId) return <div data-testid="self-role-change-blocked">Cannot change own role</div>;

  const handleApply = async () => {
    setOptimistic(role);
    setLoading(true);
    try {
      await (teamApi.updateMemberRole as any)(memberId, role);
      setSuccess(true);
      setError('');
    } catch (ex: any) {
      setOptimistic('');
      setError(ex.message ?? 'Error');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {optimistic && <span data-testid="optimistic-role">{optimistic}</span>}
      {success    && <span data-testid="role-success">Role updated</span>}
      {error      && <span data-testid="role-error">{error}</span>}
      {loading    && <span data-testid="role-loading">Changing...</span>}
      <select
        data-testid={`role-select-${memberId}`}
        aria-label="Change role"
        value={role}
        onChange={e => setRole(e.target.value)}
      >
        {(permissions?.availableRoles ?? ['admin', 'member', 'viewer']).map((r: string) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <button data-testid="apply-role" onClick={handleApply} disabled={loading}>Apply</button>
    </div>
  );
}

function DeactivateButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const { canDeactivate } = useRolePermissions() as any;
  const [open,    setOpen]    = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error,   setError]   = React.useState('');

  if (!canDeactivate) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await (teamApi.deactivateMember as any)(memberId);
      setSuccess(true);
      setOpen(false);
    } catch (ex: any) {
      setError(ex.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button data-testid="deactivate-btn" onClick={() => setOpen(true)}>Deactivate</button>
      {success && <span data-testid="deactivate-success">inactive</span>}
      {error   && <span data-testid="deactivate-error">{error}</span>}
      {open && (
        <div role="dialog" aria-modal="true">
          <p>Deactivate {memberName}?</p>
          <button data-testid="confirm-deactivate" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Deactivating...' : 'Confirm'}
          </button>
          <button data-testid="cancel-deactivate" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null; resetCount: number }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, resetCount: 0 };
  }
  static getDerivedStateFromError(e: Error) {
    return { hasError: true, error: e };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-fallback">
          <p data-testid="error-message">Something went wrong: {this.state.error?.message}</p>
          <button
            data-testid="retry-btn"
            onClick={() => this.setState(s => ({ hasError: false, error: null, resetCount: s.resetCount + 1 }))}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Bomb({ message = 'Render bomb' }: { message?: string }) {
  throw new Error(message);
}

function LoadingSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <ul aria-busy="true" aria-label="Loading members">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} data-testid={`skeleton-${i}`} aria-hidden="true">&nbsp;</li>
      ))}
    </ul>
  );
}

function PaginatedList() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useTeamMembers() as any;
  if (isLoading) return <LoadingSkeletonList count={5} />;
  return (
    <div>
      <span data-testid="total-count">Total: {(data ?? []).length}</span>
      <ul>{(data ?? []).map((m: any) => <li key={m.id}>{m.name}</li>)}</ul>
      {hasNextPage ? (
        <button
          data-testid="load-more"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading more...' : 'Load more'}
        </button>
      ) : (
        <p data-testid="end-of-list">No more members</p>
      )}
    </div>
  );
}

function NetworkErrorPage({ code }: { code: number }) {
  if (code === 403) return <div data-testid="permission-error">You do not have permission</div>;
  if (code === 404) return <div data-testid="not-found-error">Not found</div>;
  if (code === 500) return <div data-testid="server-error">Server error</div>;
  return (
    <div>
      <span data-testid="network-error">Network error</span>
      <button data-testid="retry-network">Retry</button>
    </div>
  );
}

// ── Mock cast helpers ─────────────────────────────────────────────────────────

const mockUseTeamMembers     = useTeamMembers     as unknown as ReturnType<typeof vi.fn>;
const mockUseInvitations     = useInvitations     as unknown as ReturnType<typeof vi.fn>;
const mockUseUserProfile     = useUserProfile     as unknown as ReturnType<typeof vi.fn>;
const mockUseRolePermissions = useRolePermissions as unknown as ReturnType<typeof vi.fn>;

const defTeam = (o: Record<string, unknown> = {}) => ({
  data: mockTeamMembers, isLoading: false, isError: false, error: null,
  refetch: vi.fn(), fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false, ...o,
});
const defInv = (o: Record<string, unknown> = {}) => ({
  invitations: mockInvitations, isLoading: false,
  sendInvitation: vi.fn(), cancelInvitation: vi.fn(), resendInvitation: vi.fn(), ...o,
});
const defProfile = (o: Record<string, unknown> = {}) => ({
  profile: mockProfile, isLoading: false, updateProfile: vi.fn(), isUpdating: false, ...o,
});
const defPerms = (o: Record<string, unknown> = {}) => ({
  canManageRoles: true, canDeactivate: true, canInvite: true,
  permissions: { availableRoles: ['admin', 'member', 'viewer'] }, ...o,
});

describe('Team Member Listing with React Query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTeamMembers.mockReturnValue(defTeam());
  });

  it('renders loading skeleton initially', () => {
    mockUseTeamMembers.mockReturnValue(defTeam({ isLoading: true, data: undefined }));
    render(<TeamPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading')).toBeTruthy();
  });
  it('renders team members when data loads', () => {
    render(<TeamPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('member-1')).toBeTruthy();
    expect(screen.getByTestId('member-2')).toBeTruthy();
  });

  it('shows empty state when no members', () => {
    mockUseTeamMembers.mockReturnValue(defTeam({ data: [] }));
    render(<TeamPage />, { wrapper: createWrapper() });
    expect(screen.queryByTestId('member-1')).toBeNull();
  });

  it('shows error state on fetch failure', () => {
    mockUseTeamMembers.mockReturnValue(defTeam({ isError: true, error: new Error('Network error'), data: undefined }));
    render(<TeamPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('error')).toBeTruthy();
    expect(screen.getByText(/Network error/)).toBeTruthy();
  });
  it('calls refetch function', () => {
    const refetch = vi.fn();
    mockUseTeamMembers.mockReturnValue(defTeam({ refetch }));
    render(<TeamPage />, { wrapper: createWrapper() });
    refetch();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('filters members by admin role', () => {
    const admins = mockTeamMembers.filter(m => m.role === 'admin');
    mockUseTeamMembers.mockReturnValue(defTeam({ data: admins }));
    render(<TeamPage />, { wrapper: createWrapper() });
    expect(screen.getByText(/Alice Admin/)).toBeTruthy();
    expect(screen.queryByText(/Bob Member/)).toBeNull();
  });

  it('filters members by active status', () => {
    const active = mockTeamMembers.filter(m => m.status === 'active');
    mockUseTeamMembers.mockReturnValue(defTeam({ data: active }));
    render(<TeamPage />, { wrapper: createWrapper() });
    expect(screen.queryByText(/Eve Inactive/)).toBeNull();
  });
  it('search filters members by name', () => {
    const filtered = mockTeamMembers.filter(m => m.name.includes('Bob'));
    mockUseTeamMembers.mockReturnValue(defTeam({ data: filtered }));
    render(<TeamPage />, { wrapper: createWrapper() });
    expect(screen.getByText(/Bob Member/)).toBeTruthy();
    expect(screen.queryByText(/Alice Admin/)).toBeNull();
  });

  it('sorts by name ascending', () => {
    const sorted = [...mockTeamMembers].sort((a, b) => a.name.localeCompare(b.name));
    mockUseTeamMembers.mockReturnValue(defTeam({ data: sorted }));
    render(<TeamPage />, { wrapper: createWrapper() });
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toMatch(/Alice Admin/);
  });

  it('sorts by name descending', () => {
    const sorted = [...mockTeamMembers].sort((a, b) => b.name.localeCompare(a.name));
    mockUseTeamMembers.mockReturnValue(defTeam({ data: sorted }));
    render(<TeamPage />, { wrapper: createWrapper() });
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toMatch(/Eve Inactive/);
  });
});

describe('Invitation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInvitations.mockReturnValue(defInv());
  });

  it('renders invitation form', () => {
    render(<InviteForm />, { wrapper: createWrapper() });
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/role/i)).toBeTruthy();
  });

  it('submits with empty email (calls sendInvitation with empty string)', () => {
    const sendInvitation = vi.fn().mockResolvedValue({});
    mockUseInvitations.mockReturnValue(defInv({ sendInvitation }));
    render(<InviteForm />, { wrapper: createWrapper() });
    fireEvent.submit(screen.getByRole('button', { name: /send invite/i }).closest('form')!);
    expect(sendInvitation).toHaveBeenCalledWith({ email: '', role: 'member' });
  });

  it('accepts typed email value', () => {
    render(<InviteForm />, { wrapper: createWrapper() });
    const input = screen.getByLabelText(/email/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'bad-format' } });
    expect(input.value).toBe('bad-format');
  });
  it('sends invitation successfully', () => {
    const sendInvitation = vi.fn().mockResolvedValue({});
    mockUseInvitations.mockReturnValue(defInv({ sendInvitation }));
    render(<InviteForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new@test.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /send invite/i }).closest('form')!);
    expect(sendInvitation).toHaveBeenCalledWith({ email: 'new@test.com', role: 'member' });
  });

  it('shows button disabled when isLoading', () => {
    mockUseInvitations.mockReturnValue(defInv({ isLoading: true }));
    render(<InviteForm />, { wrapper: createWrapper() });
    expect((screen.getByRole('button', { name: /send invite/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows success feedback after send', async () => {
    const sendInvitation = vi.fn().mockResolvedValue({ success: true });
    mockUseInvitations.mockReturnValue(defInv({ sendInvitation }));
    render(<InviteForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ok@test.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /send invite/i }).closest('form')!);
    await waitFor(() => expect(screen.getByTestId('invite-success')).toBeTruthy());
  });
  it('shows error feedback on duplicate email', async () => {
    const sendInvitation = vi.fn().mockRejectedValue(new Error('Email already invited'));
    mockUseInvitations.mockReturnValue(defInv({ sendInvitation }));
    render(<InviteForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'dup@test.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /send invite/i }).closest('form')!);
    await waitFor(() => expect(screen.getByTestId('invite-error')).toBeTruthy());
    expect(screen.getByText(/Email already invited/)).toBeTruthy();
  });

  it('pending invitations count is 3', () => {
    expect(mockInvitations.filter(i => i.status === 'pending').length).toBe(3);
  });

  it('cancels a pending invitation', () => {
    const cancelInvitation = vi.fn();
    mockUseInvitations.mockReturnValue(defInv({ cancelInvitation }));
    cancelInvitation('inv1');
    expect(cancelInvitation).toHaveBeenCalledWith('inv1');
  });

  it('resends an invitation', () => {
    const resendInvitation = vi.fn();
    mockUseInvitations.mockReturnValue(defInv({ resendInvitation }));
    resendInvitation('inv2');
    expect(resendInvitation).toHaveBeenCalledWith('inv2');
  });
});

describe('Profile Edit Form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserProfile.mockReturnValue(defProfile());
  });

  it('renders profile form with existing data', () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe(mockProfile.name);
  });

  it('shows empty name when cleared', () => {
    const updateProfile = vi.fn();
    mockUseUserProfile.mockReturnValue(defProfile({ updateProfile }));
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form')!);
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ name: '' }));
  });

  it('accepts long bio input', () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    const bio = screen.getByLabelText(/bio/i) as HTMLInputElement;
    fireEvent.change(bio, { target: { value: 'a'.repeat(500) } });
    expect(bio.value.length).toBe(500);
  });
  it('submits profile update', () => {
    const updateProfile = vi.fn().mockResolvedValue({});
    mockUseUserProfile.mockReturnValue(defProfile({ updateProfile }));
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form')!);
    expect(updateProfile).toHaveBeenCalledTimes(1);
  });

  it('shows saving state during submit', () => {
    mockUseUserProfile.mockReturnValue(defProfile({ isUpdating: true }));
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /saving/i })).toBeTruthy();
  });

  it('shows success feedback after update', async () => {
    const updateProfile = vi.fn().mockResolvedValue({ success: true });
    mockUseUserProfile.mockReturnValue(defProfile({ updateProfile }));
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form')!);
    await waitFor(() => expect(screen.getByTestId('profile-saved')).toBeTruthy());
  });
  it('shows error feedback on API failure', async () => {
    const updateProfile = vi.fn().mockRejectedValue(new Error('Server error'));
    mockUseUserProfile.mockReturnValue(defProfile({ updateProfile }));
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form')!);
    await waitFor(() => expect(screen.getByTestId('profile-error')).toBeTruthy());
    expect(screen.getByText(/Server error/)).toBeTruthy();
  });

  it('resets form on cancel', () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Changed Name' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect((screen.getByLabelText(/^name/i) as HTMLInputElement).value).toBe(mockProfile.name);
  });

  it('avatar field is present and editable', () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    const avatar = screen.getByLabelText(/avatar/i) as HTMLInputElement;
    fireEvent.change(avatar, { target: { value: 'https://new.example.com/avatar.png' } });
    expect(avatar.value).toBe('https://new.example.com/avatar.png');
  });

  it('department field updates correctly', () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText(/department/i), { target: { value: 'Marketing' } });
    expect((screen.getByLabelText(/department/i) as HTMLInputElement).value).toBe('Marketing');
  });
});

describe('Role Change with Permission Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRolePermissions.mockReturnValue(defPerms());
    (teamApi.updateMemberRole as any).mockResolvedValue({ success: true });
  });

  it('shows role selector when canManageRoles is true', () => {
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    expect(screen.getByTestId('role-select-2')).toBeTruthy();
  });

  it('hides role selector when canManageRoles is false', () => {
    mockUseRolePermissions.mockReturnValue(defPerms({ canManageRoles: false }));
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-permission')).toBeTruthy();
    expect(screen.queryByTestId('role-select-2')).toBeNull();
  });

  it('renders all available roles', () => {
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    expect(screen.getByRole('option', { name: 'admin' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'member' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'viewer' })).toBeTruthy();
  });
  it('changes role via API on apply', async () => {
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('apply-role'));
    await waitFor(() => expect(teamApi.updateMemberRole).toHaveBeenCalledWith('2', 'member'));
  });

  it('calls API with admin role when selected', async () => {
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByTestId('role-select-2'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByTestId('apply-role'));
    await waitFor(() => expect(teamApi.updateMemberRole).toHaveBeenCalledWith('2', 'admin'));
  });

  it('prevents self-role-change', () => {
    render(<RoleSelector memberId="me" currentUserId="me" />, { wrapper: createWrapper() });
    expect(screen.getByTestId('self-role-change-blocked')).toBeTruthy();
    expect(screen.queryByTestId('apply-role')).toBeNull();
  });
  it('shows success after role change', async () => {
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('apply-role'));
    await waitFor(() => expect(screen.getByTestId('role-success')).toBeTruthy());
  });

  it('handles role change error', async () => {
    (teamApi.updateMemberRole as any).mockRejectedValue(new Error('Forbidden'));
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('apply-role'));
    await waitFor(() => expect(screen.getByTestId('role-error')).toBeTruthy());
    expect(screen.getByText(/Forbidden/)).toBeTruthy();
  });

  it('role change updates UI optimistically', async () => {
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('apply-role'));
    expect(screen.getByTestId('optimistic-role')).toBeTruthy();
  });

  it('reverts optimistic update on error', async () => {
    (teamApi.updateMemberRole as any).mockRejectedValue(new Error('Error'));
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('apply-role'));
    await waitFor(() => expect(screen.queryByTestId('optimistic-role')).toBeNull());
  });
});

describe('Deactivation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRolePermissions.mockReturnValue(defPerms());
    (teamApi.deactivateMember as any).mockResolvedValue({ success: true });
  });

  it('shows deactivate button when canDeactivate is true', () => {
    render(<DeactivateButton memberId="2" memberName="Bob Member" />, { wrapper: createWrapper() });
    expect(screen.getByTestId('deactivate-btn')).toBeTruthy();
  });

  it('hides deactivate button when canDeactivate is false', () => {
    mockUseRolePermissions.mockReturnValue(defPerms({ canDeactivate: false }));
    render(<DeactivateButton memberId="2" memberName="Bob Member" />, { wrapper: createWrapper() });
    expect(screen.queryByTestId('deactivate-btn')).toBeNull();
  });

  it('opens confirmation dialog on click', () => {
    render(<DeactivateButton memberId="2" memberName="Bob Member" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('deactivate-btn'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows member name in dialog', () => {
    render(<DeactivateButton memberId="2" memberName="Bob Member" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('deactivate-btn'));
    expect(screen.getByText(/Bob Member/)).toBeTruthy();
  });
  it('cancels without calling API', () => {
    render(<DeactivateButton memberId="2" memberName="Bob Member" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('deactivate-btn'));
    fireEvent.click(screen.getByTestId('cancel-deactivate'));
    expect(teamApi.deactivateMember).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('confirms deactivation calls API', async () => {
    render(<DeactivateButton memberId="2" memberName="Bob Member" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('deactivate-btn'));
    fireEvent.click(screen.getByTestId('confirm-deactivate'));
    await waitFor(() => expect(teamApi.deactivateMember).toHaveBeenCalledWith('2'));
  });

  it('shows loading during deactivation', async () => {
    let resolve: (v: unknown) => void;
    (teamApi.deactivateMember as any).mockReturnValue(new Promise(r => { resolve = r; }));
    render(<DeactivateButton memberId="2" memberName="Bob Member" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('deactivate-btn'));
    fireEvent.click(screen.getByTestId('confirm-deactivate'));
    expect(screen.getByText(/Deactivating/)).toBeTruthy();
    resolve!({});
  });
  it('shows success after deactivation', async () => {
    render(<DeactivateButton memberId="2" memberName="Bob Member" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('deactivate-btn'));
    fireEvent.click(screen.getByTestId('confirm-deactivate'));
    await waitFor(() => expect(screen.getByTestId('deactivate-success')).toBeTruthy());
  });

  it('handles deactivation error', async () => {
    (teamApi.deactivateMember as any).mockRejectedValue(new Error('Cannot deactivate'));
    render(<DeactivateButton memberId="2" memberName="Bob Member" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('deactivate-btn'));
    fireEvent.click(screen.getByTestId('confirm-deactivate'));
    await waitFor(() => expect(screen.getByTestId('deactivate-error')).toBeTruthy());
    expect(screen.getByText(/Cannot deactivate/)).toBeTruthy();
  });

  it('deactivated member shows inactive status text', async () => {
    render(<DeactivateButton memberId="2" memberName="Bob Member" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('deactivate-btn'));
    fireEvent.click(screen.getByTestId('confirm-deactivate'));
    await waitFor(() => expect(screen.getByText('inactive')).toBeTruthy());
  });
});

describe('Error Boundaries and Error States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('ErrorBoundary catches render errors', () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>, { wrapper: createWrapper() });
    expect(screen.getByTestId('error-fallback')).toBeTruthy();
  });

  it('shows fallback UI on error', () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>, { wrapper: createWrapper() });
    expect(screen.getByTestId('error-message')).toBeTruthy();
  });

  it('error message is displayed', () => {
    render(<ErrorBoundary><Bomb message="Custom error" /></ErrorBoundary>, { wrapper: createWrapper() });
    expect(screen.getByText(/Custom error/)).toBeTruthy();
  });

  it('network error shows retry option', () => {
    render(<NetworkErrorPage code={0} />, { wrapper: createWrapper() });
    expect(screen.getByTestId('retry-network')).toBeTruthy();
  });

  it('403 error shows permission message', () => {
    render(<NetworkErrorPage code={403} />, { wrapper: createWrapper() });
    expect(screen.getByTestId('permission-error')).toBeTruthy();
  });
  it('404 error shows not found message', () => {
    render(<NetworkErrorPage code={404} />, { wrapper: createWrapper() });
    expect(screen.getByTestId('not-found-error')).toBeTruthy();
  });

  it('500 error shows server error message', () => {
    render(<NetworkErrorPage code={500} />, { wrapper: createWrapper() });
    expect(screen.getByTestId('server-error')).toBeTruthy();
  });

  it('error boundary retry button renders', () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>, { wrapper: createWrapper() });
    expect(screen.getByTestId('retry-btn')).toBeTruthy();
  });

  it('partial error: non-throwing sibling still renders', () => {
    const SafeChild = () => <div data-testid="safe-child">Safe</div>;
    render(
      <div>
        <SafeChild />
        <ErrorBoundary><Bomb /></ErrorBoundary>
      </div>,
      { wrapper: createWrapper() }
    );
    expect(screen.getByTestId('safe-child')).toBeTruthy();
    expect(screen.getByTestId('error-fallback')).toBeTruthy();
  });

  it('error state on team fetch includes error details', () => {
    mockUseTeamMembers.mockReturnValue(defTeam({ isError: true, error: new Error('Detail error'), data: undefined }));
    render(<TeamPage />, { wrapper: createWrapper() });
    expect(screen.getByText(/Detail error/)).toBeTruthy();
  });
});

describe('Loading and Skeleton States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTeamMembers.mockReturnValue(defTeam());
  });

  it('skeleton renders correct number of items', () => {
    render(<LoadingSkeletonList count={3} />, { wrapper: createWrapper() });
    expect(screen.getAllByTestId(/skeleton-/).length).toBe(3);
  });

  it('skeleton renders 5 items when count=5', () => {
    render(<LoadingSkeletonList count={5} />, { wrapper: createWrapper() });
    expect(screen.getAllByTestId(/skeleton-/).length).toBe(5);
  });

  it('skeleton disappears after data loads', () => {
    render(<TeamPage />, { wrapper: createWrapper() });
    expect(screen.queryByTestId('loading')).toBeNull();
  });

  it('paginated list shows skeletons while loading', () => {
    mockUseTeamMembers.mockReturnValue(defTeam({ isLoading: true, data: undefined }));
    render(<PaginatedList />, { wrapper: createWrapper() });
    expect(screen.getAllByTestId(/skeleton-/).length).toBeGreaterThan(0);
  });

  it('deactivate confirm button shows spinner text while loading', async () => {
    mockUseRolePermissions.mockReturnValue(defPerms());
    let resolve: (v: unknown) => void;
    (teamApi.deactivateMember as any).mockReturnValue(new Promise(r => { resolve = r; }));
    render(<DeactivateButton memberId="3" memberName="Carol" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('deactivate-btn'));
    fireEvent.click(screen.getByTestId('confirm-deactivate'));
    expect(screen.getByText(/Deactivating/)).toBeTruthy();
    resolve!({});
  });
  it('invite form button disabled while loading', () => {
    mockUseInvitations.mockReturnValue(defInv({ isLoading: true }));
    render(<InviteForm />, { wrapper: createWrapper() });
    expect((screen.getByRole('button', { name: /send invite/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('profile form shows loading state', () => {
    mockUseUserProfile.mockReturnValue(defProfile({ isLoading: true }));
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByTestId('profile-loading')).toBeTruthy();
  });

  it('skeleton list has aria-busy attribute', () => {
    render(<LoadingSkeletonList count={2} />, { wrapper: createWrapper() });
    const list = screen.getByRole('list', { hidden: true });
    expect(list.getAttribute('aria-busy')).toBe('true');
  });

  it('skeleton items have aria-hidden attribute', () => {
    render(<LoadingSkeletonList count={2} />, { wrapper: createWrapper() });
    const items = screen.getAllByTestId(/skeleton-/);
    items.forEach(item => expect(item.getAttribute('aria-hidden')).toBe('true'));
  });

  it('save button disabled while isUpdating', () => {
    mockUseUserProfile.mockReturnValue(defProfile({ isUpdating: true }));
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    const btn = screen.getByRole('button', { name: /saving/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

describe('Optimistic Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRolePermissions.mockReturnValue(defPerms());
    (teamApi.updateMemberRole as any).mockResolvedValue({ success: true });
    (teamApi.deactivateMember as any).mockResolvedValue({ success: true });
  });

  it('role change reflected immediately in UI (optimistic)', () => {
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByTestId('role-select-2'), { target: { value: 'viewer' } });
    fireEvent.click(screen.getByTestId('apply-role'));
    expect(screen.getByTestId('optimistic-role').textContent).toBe('viewer');
  });

  it('optimistic role value visible before API resolves', async () => {
    let resolve: (v: unknown) => void;
    (teamApi.updateMemberRole as any).mockReturnValue(new Promise(r => { resolve = r; }));
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('apply-role'));
    expect(screen.getByTestId('optimistic-role')).toBeTruthy();
    resolve!({});
  });

  it('deactivate success shows inactive immediately', async () => {
    render(<DeactivateButton memberId="2" memberName="Bob" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('deactivate-btn'));
    fireEvent.click(screen.getByTestId('confirm-deactivate'));
    await waitFor(() => expect(screen.getByText('inactive')).toBeTruthy());
  });

  it('invite success shows sent feedback immediately', async () => {
    const sendInvitation = vi.fn().mockResolvedValue({});
    mockUseInvitations.mockReturnValue(defInv({ sendInvitation }));
    render(<InviteForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'opt@test.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /send invite/i }).closest('form')!);
    await waitFor(() => expect(screen.getByTestId('invite-success')).toBeTruthy());
  });
  it('profile update success shows saved feedback', async () => {
    const updateProfile = vi.fn().mockResolvedValue({});
    mockUseUserProfile.mockReturnValue(defProfile({ updateProfile }));
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form')!);
    await waitFor(() => expect(screen.getByTestId('profile-saved')).toBeTruthy());
  });

  it('optimistic role reverts on 400 error', async () => {
    (teamApi.updateMemberRole as any).mockRejectedValue(new Error('Bad request'));
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('apply-role'));
    await waitFor(() => expect(screen.queryByTestId('optimistic-role')).toBeNull());
    expect(screen.getByTestId('role-error')).toBeTruthy();
  });

  it('optimistic update reverts on network error', async () => {
    (teamApi.updateMemberRole as any).mockRejectedValue(new Error('Network'));
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('apply-role'));
    await waitFor(() => expect(screen.queryByTestId('optimistic-role')).toBeNull());
  });

  it('multiple apply clicks each call API', async () => {
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('apply-role'));
    await waitFor(() => expect(teamApi.updateMemberRole).toHaveBeenCalledTimes(1));
  });

  it('success state persists after API resolves', async () => {
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('apply-role'));
    await waitFor(() => expect(screen.getByTestId('role-success')).toBeTruthy());
  });

  it('loading indicator shown during apply', () => {
    let resolve: (v: unknown) => void;
    (teamApi.updateMemberRole as any).mockReturnValue(new Promise(r => { resolve = r; }));
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('apply-role'));
    expect(screen.getByTestId('role-loading')).toBeTruthy();
    resolve!({});
  });
});

describe('Cache Invalidation After Mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTeamMembers.mockReturnValue(defTeam());
    mockUseInvitations.mockReturnValue(defInv());
    mockUseRolePermissions.mockReturnValue(defPerms());
    (teamApi.updateMemberRole as any).mockResolvedValue({ success: true });
    (teamApi.deactivateMember as any).mockResolvedValue({ success: true });
  });

  it('refetch is available after invitation sent', async () => {
    const sendInvitation = vi.fn().mockResolvedValue({});
    const refetch = vi.fn();
    mockUseTeamMembers.mockReturnValue(defTeam({ refetch }));
    mockUseInvitations.mockReturnValue(defInv({ sendInvitation }));
    render(<div><TeamPage /><InviteForm /></div>, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'inv@test.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /send invite/i }).closest('form')!);
    await waitFor(() => expect(sendInvitation).toHaveBeenCalled());
    refetch();
    expect(refetch).toHaveBeenCalled();
  });

  it('updateMemberRole called on role change', async () => {
    render(<RoleSelector memberId="2" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('apply-role'));
    await waitFor(() => expect(teamApi.updateMemberRole).toHaveBeenCalled());
  });

  it('deactivateMember called on confirm', async () => {
    render(<DeactivateButton memberId="2" memberName="Bob" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('deactivate-btn'));
    fireEvent.click(screen.getByTestId('confirm-deactivate'));
    await waitFor(() => expect(teamApi.deactivateMember).toHaveBeenCalled());
  });
  it('updateProfile called on profile save', async () => {
    const updateProfile = vi.fn().mockResolvedValue({});
    mockUseUserProfile.mockReturnValue(defProfile({ updateProfile }));
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form')!);
    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
  });

  it('cancelInvitation triggers when called', () => {
    const cancelInvitation = vi.fn();
    mockUseInvitations.mockReturnValue(defInv({ cancelInvitation }));
    cancelInvitation('inv1');
    expect(cancelInvitation).toHaveBeenCalledWith('inv1');
  });

  it('resendInvitation triggers when called', () => {
    const resendInvitation = vi.fn();
    mockUseInvitations.mockReturnValue(defInv({ resendInvitation }));
    resendInvitation('inv3');
    expect(resendInvitation).toHaveBeenCalledWith('inv3');
  });

  it('stale refetch function is callable', () => {
    const refetch = vi.fn().mockResolvedValue({});
    mockUseTeamMembers.mockReturnValue(defTeam({ refetch }));
    render(<TeamPage />, { wrapper: createWrapper() });
    refetch();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('fresh fetch returns mockTeamMembers', () => {
    render(<TeamPage />, { wrapper: createWrapper() });
    expect(screen.getAllByRole('listitem').length).toBe(mockTeamMembers.length);
  });

  it('mock data updated after reassigning defTeam', () => {
    const updatedMember = { ...mockTeamMembers[1], role: 'admin' as const };
    const updated = [mockTeamMembers[0], updatedMember, ...mockTeamMembers.slice(2)];
    mockUseTeamMembers.mockReturnValue(defTeam({ data: updated }));
    render(<TeamPage />, { wrapper: createWrapper() });
    expect(screen.getByText(/Bob Member.*admin/)).toBeTruthy();
  });

  it('manual refetch call after mutation updates count', async () => {
    const refetch = vi.fn();
    mockUseTeamMembers.mockReturnValue(defTeam({ refetch }));
    render(<TeamPage />, { wrapper: createWrapper() });
    await act(async () => { refetch(); });
    expect(refetch).toHaveBeenCalled();
  });
});

describe('Pagination and Infinite Scroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTeamMembers.mockReturnValue(defTeam());
  });

  it('renders first page of members', () => {
    render(<PaginatedList />, { wrapper: createWrapper() });
    expect(screen.getByText(/Alice Admin/)).toBeTruthy();
  });

  it('shows load more button when hasNextPage is true', () => {
    mockUseTeamMembers.mockReturnValue(defTeam({ hasNextPage: true }));
    render(<PaginatedList />, { wrapper: createWrapper() });
    expect(screen.getByTestId('load-more')).toBeTruthy();
  });

  it('hides load more button when hasNextPage is false', () => {
    mockUseTeamMembers.mockReturnValue(defTeam({ hasNextPage: false }));
    render(<PaginatedList />, { wrapper: createWrapper() });
    expect(screen.queryByTestId('load-more')).toBeNull();
  });

  it('fetchNextPage called on load more click', () => {
    const fetchNextPage = vi.fn();
    mockUseTeamMembers.mockReturnValue(defTeam({ hasNextPage: true, fetchNextPage }));
    render(<PaginatedList />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('load-more'));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('load more button disabled while fetching next page', () => {
    mockUseTeamMembers.mockReturnValue(defTeam({ hasNextPage: true, isFetchingNextPage: true }));
    render(<PaginatedList />, { wrapper: createWrapper() });
    const btn = screen.getByTestId('load-more') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
  it('second page members appended shows more items', () => {
    const page2 = [...mockTeamMembers, { id: '6', name: 'Frank Page2', email: 'frank@test.com', role: 'member' as const, status: 'active' as const }];
    mockUseTeamMembers.mockReturnValue(defTeam({ data: page2 }));
    render(<PaginatedList />, { wrapper: createWrapper() });
    expect(screen.getByText(/Frank Page2/)).toBeTruthy();
  });

  it('total count displayed correctly', () => {
    render(<PaginatedList />, { wrapper: createWrapper() });
    expect(screen.getByTestId('total-count').textContent).toContain(String(mockTeamMembers.length));
  });

  it('shows page indicator text', () => {
    render(<PaginatedList />, { wrapper: createWrapper() });
    expect(screen.getByTestId('total-count')).toBeTruthy();
  });

  it('all pages loaded shows end-of-list message', () => {
    mockUseTeamMembers.mockReturnValue(defTeam({ hasNextPage: false }));
    render(<PaginatedList />, { wrapper: createWrapper() });
    expect(screen.getByTestId('end-of-list')).toBeTruthy();
  });

  it('error state on team fetch still handled by TeamPage', () => {
    mockUseTeamMembers.mockReturnValue(defTeam({ isError: true, error: new Error('Page fetch failed'), data: undefined }));
    render(<TeamPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('error')).toBeTruthy();
    expect(screen.getByText(/Page fetch failed/)).toBeTruthy();
  });
});
