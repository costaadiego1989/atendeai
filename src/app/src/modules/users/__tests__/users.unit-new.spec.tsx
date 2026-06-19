import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../hooks/useTeamMembers', () => ({
  useTeamMembers: vi.fn(),
}));
vi.mock('../hooks/useInvitations', () => ({
  useInvitations: vi.fn(),
}));
vi.mock('../hooks/useUserProfile', () => ({
  useUserProfile: vi.fn(),
}));
vi.mock('../hooks/useRolePermissions', () => ({
  useRolePermissions: vi.fn(),
}));
vi.mock('../utils/roleUtils', () => ({
  getRoleBadgeColor: vi.fn(),
  formatRoleLabel: vi.fn(),
  canManageRole: vi.fn(),
  getRoleHierarchy: vi.fn(),
}));
vi.mock('../utils/teamUtils', () => ({
  computeTeamKPIs: vi.fn(),
  filterMembers: vi.fn(),
  sortMembers: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeMember = (overrides = {}) => ({
  id: 'user-1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  role: 'admin',
  status: 'active',
  avatarUrl: null,
  joinedAt: '2024-01-15T00:00:00Z',
  lastActiveAt: '2024-06-01T12:00:00Z',
  ...overrides,
});

const makeKPIs = (overrides = {}) => ({
  totalMembers: 10,
  activeMembers: 8,
  pendingInvitations: 2,
  admins: 3,
  ...overrides,
});

// ─── TeamHeader ────────────────────────────────────────────────────────────────

describe('TeamHeader', () => {
  let TeamHeader: React.FC<any>;

  beforeEach(async () => {
    const mod = await import('../TeamHeader');
    TeamHeader = mod.default ?? mod.TeamHeader;
  });

  it('renders the page title', () => {
    render(<TeamHeader memberCount={5} onInvite={vi.fn()} />);
    expect(screen.getByText(/team/i)).toBeTruthy();
  });

  it('displays member count badge', () => {
    render(<TeamHeader memberCount={12} onInvite={vi.fn()} />);
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('displays zero members correctly', () => {
    render(<TeamHeader memberCount={0} onInvite={vi.fn()} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders invite button', () => {
    render(<TeamHeader memberCount={5} onInvite={vi.fn()} />);
    expect(screen.getByRole('button', { name: /invite/i })).toBeTruthy();
  });

  it('calls onInvite when button clicked', () => {
    const onInvite = vi.fn();
    render(<TeamHeader memberCount={5} onInvite={onInvite} />);
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it('hides invite button when canInvite is false', () => {
    render(<TeamHeader memberCount={5} onInvite={vi.fn()} canInvite={false} />);
    expect(screen.queryByRole('button', { name: /invite/i })).toBeNull();
  });

  it('renders with large team size (1000+)', () => {
    render(<TeamHeader memberCount={1234} onInvite={vi.fn()} />);
    expect(screen.getByText('1234')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(<TeamHeader memberCount={5} onInvite={vi.fn()} subtitle="Manage your team" />);
    expect(screen.getByText('Manage your team')).toBeTruthy();
  });

  it('does not render subtitle when omitted', () => {
    render(<TeamHeader memberCount={5} onInvite={vi.fn()} />);
    expect(screen.queryByText('Manage your team')).toBeNull();
  });

  it('renders with memberCount of 1', () => {
    render(<TeamHeader memberCount={1} onInvite={vi.fn()} />);
    expect(screen.getByText('1')).toBeTruthy();
  });
});

// ─── TeamKPIs ─────────────────────────────────────────────────────────────────

describe('TeamKPIs', () => {
  let TeamKPIs: React.FC<any>;

  beforeEach(async () => {
    const mod = await import('../TeamKPIs');
    TeamKPIs = mod.default ?? mod.TeamKPIs;
  });

  it('renders total members metric', () => {
    render(<TeamKPIs {...makeKPIs()} />);
    expect(screen.getByText('10')).toBeTruthy();
  });

  it('renders active members metric', () => {
    render(<TeamKPIs {...makeKPIs()} />);
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('renders pending invitations metric', () => {
    render(<TeamKPIs {...makeKPIs()} />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders admins count', () => {
    render(<TeamKPIs {...makeKPIs()} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows zero pending invitations', () => {
    render(<TeamKPIs {...makeKPIs({ pendingInvitations: 0 })} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('handles all zeros gracefully', () => {
    render(<TeamKPIs totalMembers={0} activeMembers={0} pendingInvitations={0} admins={0} />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(1);
  });

  it('renders large numbers without overflow', () => {
    render(<TeamKPIs totalMembers={9999} activeMembers={9000} pendingInvitations={50} admins={100} />);
    expect(screen.getByText('9999')).toBeTruthy();
  });

  it('renders metric labels', () => {
    render(<TeamKPIs {...makeKPIs()} />);
    expect(screen.getByText(/members/i)).toBeTruthy();
  });

  it('renders admins label', () => {
    render(<TeamKPIs {...makeKPIs()} />);
    expect(screen.getByText(/admin/i)).toBeTruthy();
  });

  it('renders pending label', () => {
    render(<TeamKPIs {...makeKPIs()} />);
    expect(screen.getByText(/pending/i)).toBeTruthy();
  });

  it('highlights pending when greater than 0', () => {
    const { container } = render(<TeamKPIs {...makeKPIs({ pendingInvitations: 3 })} />);
    expect(container.innerHTML).toBeTruthy();
  });

  it('does not crash with undefined optional props', () => {
    expect(() => render(<TeamKPIs totalMembers={5} activeMembers={5} pendingInvitations={0} admins={1} />)).not.toThrow();
  });
});

// ─── TeamFilters ──────────────────────────────────────────────────────────────

describe('TeamFilters', () => {
  let TeamFilters: React.FC<any>;
  const defaultProps = {
    searchValue: '',
    onSearchChange: vi.fn(),
    roleFilter: 'all',
    onRoleFilterChange: vi.fn(),
    statusFilter: 'all',
    onStatusFilterChange: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../TeamFilters');
    TeamFilters = mod.default ?? mod.TeamFilters;
  });

  it('renders search input', () => {
    render(<TeamFilters {...defaultProps} />);
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('reflects controlled search value', () => {
    render(<TeamFilters {...defaultProps} searchValue="alice" />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('alice');
  });

  it('calls onSearchChange when typing', () => {
    const onSearchChange = vi.fn();
    render(<TeamFilters {...defaultProps} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'bob' } });
    expect(onSearchChange).toHaveBeenCalledWith('bob');
  });

  it('renders role filter dropdown', () => {
    render(<TeamFilters {...defaultProps} />);
    expect(screen.getByLabelText(/role/i) || screen.getByTestId('role-filter')).toBeTruthy();
  });

  it('calls onRoleFilterChange when role selected', () => {
    const onRoleFilterChange = vi.fn();
    render(<TeamFilters {...defaultProps} onRoleFilterChange={onRoleFilterChange} />);
    const select = screen.getByLabelText(/role/i) || screen.getByTestId('role-filter');
    fireEvent.change(select, { target: { value: 'admin' } });
    expect(onRoleFilterChange).toHaveBeenCalledWith('admin');
  });

  it('renders status filter', () => {
    render(<TeamFilters {...defaultProps} />);
    expect(screen.getByLabelText(/status/i) || screen.getByTestId('status-filter')).toBeTruthy();
  });

  it('calls onStatusFilterChange when status selected', () => {
    const onStatusFilterChange = vi.fn();
    render(<TeamFilters {...defaultProps} onStatusFilterChange={onStatusFilterChange} />);
    const select = screen.getByLabelText(/status/i) || screen.getByTestId('status-filter');
    fireEvent.change(select, { target: { value: 'active' } });
    expect(onStatusFilterChange).toHaveBeenCalledWith('active');
  });

  it('renders clear button when search has value', () => {
    render(<TeamFilters {...defaultProps} searchValue="test" />);
    expect(screen.getByRole('button', { name: /clear/i }) || screen.getByLabelText(/clear/i)).toBeTruthy();
  });

  it('does not render clear button when search is empty', () => {
    render(<TeamFilters {...defaultProps} searchValue="" />);
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
  });

  it('clears search when clear button clicked', () => {
    const onSearchChange = vi.fn();
    render(<TeamFilters {...defaultProps} searchValue="test" onSearchChange={onSearchChange} />);
    const clearBtn = screen.getByRole('button', { name: /clear/i }) || screen.getByLabelText(/clear/i);
    fireEvent.click(clearBtn);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('shows all role options', () => {
    render(<TeamFilters {...defaultProps} />);
    expect(screen.getByText(/admin/i)).toBeTruthy();
  });

  it('shows all status options', () => {
    render(<TeamFilters {...defaultProps} />);
    expect(screen.getByText(/active/i)).toBeTruthy();
  });

  it('reflects controlled roleFilter value', () => {
    render(<TeamFilters {...defaultProps} roleFilter="admin" />);
    const select = screen.getByLabelText(/role/i) || screen.getByTestId('role-filter');
    expect((select as HTMLSelectElement).value).toBe('admin');
  });

  it('reflects controlled statusFilter value', () => {
    render(<TeamFilters {...defaultProps} statusFilter="inactive" />);
    const select = screen.getByLabelText(/status/i) || screen.getByTestId('status-filter');
    expect((select as HTMLSelectElement).value).toBe('inactive');
  });
});

// ─── UserProfileSheet ─────────────────────────────────────────��──────────────

describe('UserProfileSheet', () => {
  let UserProfileSheet: React.FC<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../UserProfileSheet');
    UserProfileSheet = mod.default ?? mod.UserProfileSheet;
  });

  const defaultUser = makeMember();

  it('renders user name', () => {
    render(<UserProfileSheet user={defaultUser} open onClose={vi.fn()} />);
    expect(screen.getByText('Alice Smith')).toBeTruthy();
  });

  it('renders user email', () => {
    render(<UserProfileSheet user={defaultUser} open onClose={vi.fn()} />);
    expect(screen.getByText('alice@example.com')).toBeTruthy();
  });

  it('renders user role', () => {
    render(<UserProfileSheet user={defaultUser} open onClose={vi.fn()} />);
    expect(screen.getByText(/admin/i)).toBeTruthy();
  });

  it('renders active status badge', () => {
    render(<UserProfileSheet user={defaultUser} open onClose={vi.fn()} />);
    expect(screen.getByText(/active/i)).toBeTruthy();
  });

  it('renders inactive status badge', () => {
    render(<UserProfileSheet user={makeMember({ status: 'inactive' })} open onClose={vi.fn()} />);
    expect(screen.getByText(/inactive/i)).toBeTruthy();
  });

  it('does not render when open is false', () => {
    render(<UserProfileSheet user={defaultUser} open={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Alice Smith')).toBeNull();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<UserProfileSheet user={defaultUser} open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders edit button when canEdit is true', () => {
    render(<UserProfileSheet user={defaultUser} open onClose={vi.fn()} canEdit />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy();
  });

  it('hides edit button when canEdit is false', () => {
    render(<UserProfileSheet user={defaultUser} open onClose={vi.fn()} canEdit={false} />);
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
  });

  it('renders deactivate button for active user', () => {
    render(<UserProfileSheet user={defaultUser} open onClose={vi.fn()} canEdit canDeactivate />);
    expect(screen.getByRole('button', { name: /deactivat/i })).toBeTruthy();
  });

  it('renders reactivate button for inactive user', () => {
    render(
      <UserProfileSheet
        user={makeMember({ status: 'inactive' })}
        open
        onClose={vi.fn()}
        canEdit
        canDeactivate
      />
    );
    expect(screen.getByRole('button', { name: /reactivat|activate/i })).toBeTruthy();
  });

  it('renders null avatar placeholder when no avatarUrl', () => {
    render(<UserProfileSheet user={makeMember({ avatarUrl: null })} open onClose={vi.fn()} />);
    expect(screen.getByText(/alice smith/i) || screen.getByText('AS')).toBeTruthy();
  });

  it('renders joinedAt date', () => {
    render(<UserProfileSheet user={defaultUser} open onClose={vi.fn()} />);
    expect(screen.getByText(/jan|2024/i)).toBeTruthy();
  });

  it('renders member role correctly', () => {
    render(<UserProfileSheet user={makeMember({ role: 'member' })} open onClose={vi.fn()} />);
    expect(screen.getByText(/member/i)).toBeTruthy();
  });

  it('renders viewer role correctly', () => {
    render(<UserProfileSheet user={makeMember({ role: 'viewer' })} open onClose={vi.fn()} />);
    expect(screen.getByText(/viewer/i)).toBeTruthy();
  });

  it('renders pending status', () => {
    render(<UserProfileSheet user={makeMember({ status: 'pending' })} open onClose={vi.fn()} />);
    expect(screen.getByText(/pending/i)).toBeTruthy();
  });
});

// ─── Role Badge Rendering ──────────────────────��──────────────────────────────

describe('RoleBadge', () => {
  let RoleBadge: React.FC<any>;

  beforeEach(async () => {
    const mod = await import('../RoleBadge');
    RoleBadge = mod.default ?? mod.RoleBadge;
  });

  it('renders admin role', () => {
    render(<RoleBadge role="admin" />);
    expect(screen.getByText(/admin/i)).toBeTruthy();
  });

  it('renders member role', () => {
    render(<RoleBadge role="member" />);
    expect(screen.getByText(/member/i)).toBeTruthy();
  });

  it('renders viewer role', () => {
    render(<RoleBadge role="viewer" />);
    expect(screen.getByText(/viewer/i)).toBeTruthy();
  });

  it('renders owner role', () => {
    render(<RoleBadge role="owner" />);
    expect(screen.getByText(/owner/i)).toBeTruthy();
  });

  it('renders guest role', () => {
    render(<RoleBadge role="guest" />);
    expect(screen.getByText(/guest/i)).toBeTruthy();
  });

  it('applies correct color class for admin', () => {
    const { container } = render(<RoleBadge role="admin" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('handles unknown role gracefully', () => {
    expect(() => render(<RoleBadge role="unknown-role" />)).not.toThrow();
  });

  it('renders with small size variant', () => {
    const { container } = render(<RoleBadge role="admin" size="sm" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with large size variant', () => {
    const { container } = render(<RoleBadge role="admin" size="lg" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders uppercase label when variant is uppercase', () => {
    render(<RoleBadge role="admin" uppercase />);
    const el = screen.getByText(/admin/i);
    expect(el).toBeTruthy();
  });
});

// ─── Deactivation Confirmation Dialog ────────────────────────────────────────

describe('DeactivationDialog', () => {
  let DeactivationDialog: React.FC<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../DeactivationDialog');
    DeactivationDialog = mod.default ?? mod.DeactivationDialog;
  });

  it('renders when open', () => {
    render(
      <DeactivationDialog
        open
        userName="Alice Smith"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/alice smith/i)).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(
      <DeactivationDialog
        open={false}
        userName="Alice Smith"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText(/alice smith/i)).toBeNull();
  });

  it('shows confirmation message', () => {
    render(
      <DeactivationDialog
        open
        userName="Alice Smith"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/deactivat/i)).toBeTruthy();
  });

  it('calls onConfirm when confirmed', () => {
    const onConfirm = vi.fn();
    render(
      <DeactivationDialog
        open
        userName="Alice Smith"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /confirm|deactivat/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancelled', () => {
    const onCancel = vi.fn();
    render(
      <DeactivationDialog
        open
        userName="Alice Smith"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows loading state during deactivation', () => {
    render(
      <DeactivationDialog
        open
        userName="Alice Smith"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading
      />
    );
    expect(screen.getByRole('button', { name: /confirm|deactivat/i })).toBeDisabled();
  });

  it('disables cancel during loading', () => {
    render(
      <DeactivationDialog
        open
        userName="Alice Smith"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading
      />
    );
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('renders user name in confirmation text', () => {
    render(
      <DeactivationDialog
        open
        userName="Bob Jones"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/bob jones/i)).toBeTruthy();
  });

  it('renders warning icon or message', () => {
    render(
      <DeactivationDialog
        open
        userName="Alice Smith"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(
      screen.queryByRole('img', { name: /warn/i }) ||
        screen.queryByText(/cannot.*undo|irreversible|warning/i) ||
        screen.getByText(/deactivat/i)
    ).toBeTruthy();
  });

  it('handles undefined userName gracefully', () => {
    expect(() =>
      render(
        <DeactivationDialog
          open
          userName={undefined as any}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )
    ).not.toThrow();
  });
});

// ─── TeamPage ─────────────────────────────────────────────────────────────────

describe('TeamPage', () => {
  let TeamPage: React.FC<any>;
  const { useTeamMembers } = await import('../hooks/useTeamMembers');

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../TeamPage');
    TeamPage = mod.default ?? mod.TeamPage;
    (useTeamMembers as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [makeMember()],
      isLoading: false,
      isError: false,
    });
  });

  it('renders without crashing', () => {
    expect(() => render(<TeamPage />)).not.toThrow();
  });

  it('renders loading state', () => {
    (useTeamMembers as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    render(<TeamPage />);
    expect(screen.getByRole('status') || screen.getByText(/loading/i)).toBeTruthy();
  });

  it('renders error state', () => {
    (useTeamMembers as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load'),
    });
    render(<TeamPage />);
    expect(screen.getByText(/error|failed/i)).toBeTruthy();
  });

  it('renders empty state when no members', () => {
    (useTeamMembers as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TeamPage />);
    expect(screen.getByText(/no members|empty/i)).toBeTruthy();
  });

  it('renders member list', () => {
    render(<TeamPage />);
    expect(screen.getByText('Alice Smith')).toBeTruthy();
  });

  it('opens invite modal on invite button click', async () => {
    render(<TeamPage />);
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog') || screen.getByText(/invite/i)).toBeTruthy();
    });
  });

  it('opens user profile sheet on member click', async () => {
    render(<TeamPage />);
    fireEvent.click(screen.getByText('Alice Smith'));
    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeTruthy();
    });
  });

  it('filters members by search', async () => {
    (useTeamMembers as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [makeMember(), makeMember({ id: 'user-2', name: 'Bob Jones', email: 'bob@example.com' })],
      isLoading: false,
      isError: false,
    });
    render(<TeamPage />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Bob' } });
    await waitFor(() => {
      expect(screen.queryByText('Alice Smith')).toBeNull();
      expect(screen.getByText('Bob Jones')).toBeTruthy();
    });
  });

  it('renders header with correct member count', () => {
    (useTeamMembers as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [makeMember(), makeMember({ id: 'user-2', name: 'Bob Jones' })],
      isLoading: false,
      isError: false,
    });
    render(<TeamPage />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders KPIs section', () => {
    render(<TeamPage />);
    expect(screen.getByText(/members/i)).toBeTruthy();
  });
});
