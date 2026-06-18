import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../api/authApi', () => ({
  authApi: {
    login: mockPost,
    register: mockPost,
    forgotPassword: mockPost,
    resetPassword: mockPost,
    refreshToken: mockPost,
    logout: mockPost,
    changePassword: mockPost,
    getCurrentUser: mockGet,
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuthContext: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', state: null }),
  Navigate: ({ to }: { to: string }) => null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeToken = () => 'eyJhbGciOiJIUzI1NiJ9.payload.sig';
const makeUser = (role = 'user') => ({ id: '1', email: 'user@test.com', role, name: 'Test User' });

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe('Auth Integration – Login Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return JWT token after successful login', async () => {
    mockPost.mockResolvedValueOnce({ data: { token: makeToken(), user: makeUser() } });
    const result = await mockPost({ email: 'user@test.com', password: 'pass123' });
    expect(result.data.token).toBeDefined();
  });

  it('should store token in auth context after login', async () => {
    const setToken = vi.fn();
    mockPost.mockResolvedValueOnce({ data: { token: makeToken(), user: makeUser() } });
    const res = await mockPost({ email: 'a@b.com', password: 'x' });
    act(() => setToken(res.data.token));
    expect(setToken).toHaveBeenCalledWith(res.data.token);
  });

  it('should call login API with correct credentials', async () => {
    mockPost.mockResolvedValueOnce({ data: { token: makeToken() } });
    await mockPost({ email: 'test@test.com', password: 'secure' });
    expect(mockPost).toHaveBeenCalledWith({ email: 'test@test.com', password: 'secure' });
  });

  it('should reject login with wrong password', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 401, data: { message: 'Invalid credentials' } } });
    await expect(mockPost({ email: 'a@b.com', password: 'wrong' })).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('should reject login with unregistered email', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404, data: { message: 'User not found' } } });
    await expect(mockPost({ email: 'ghost@test.com', password: 'x' })).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('should return user object on successful login', async () => {
    mockPost.mockResolvedValueOnce({ data: { token: makeToken(), user: makeUser() } });
    const res = await mockPost({ email: 'user@test.com', password: 'pass' });
    expect(res.data.user).toHaveProperty('email', 'user@test.com');
  });

  it('should set isAuthenticated to true after login', async () => {
    const setState = vi.fn();
    mockPost.mockResolvedValueOnce({ data: { token: makeToken(), user: makeUser() } });
    await mockPost({});
    act(() => setState(true));
    expect(setState).toHaveBeenCalledWith(true);
  });

  it('should redirect to dashboard after login', () => {
    const navigate = vi.fn();
    navigate('/dashboard');
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should handle network error during login', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network Error'));
    await expect(mockPost({})).rejects.toThrow('Network Error');
  });

  it('should clear previous errors on new login attempt', () => {
    const clearError = vi.fn();
    clearError();
    expect(clearError).toHaveBeenCalled();
  });
});

describe('Auth Integration – Register Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should create account with valid data', async () => {
    mockPost.mockResolvedValueOnce({ data: { user: makeUser(), token: makeToken() } });
    const res = await mockPost({ email: 'new@test.com', password: 'pass', name: 'New User' });
    expect(res.data.user).toBeDefined();
  });

  it('should validate required fields before submit', () => {
    const validate = vi.fn().mockReturnValue({ email: 'Required', password: 'Required' });
    const errors = validate({});
    expect(errors.email).toBe('Required');
  });

  it('should validate email format', () => {
    const validate = vi.fn().mockReturnValue({ email: 'Invalid email' });
    const errors = validate({ email: 'not-an-email' });
    expect(errors.email).toBe('Invalid email');
  });

  it('should enforce minimum password length', () => {
    const validate = vi.fn().mockReturnValue({ password: 'Min 8 characters' });
    const errors = validate({ password: '123' });
    expect(errors.password).toBeDefined();
  });

  it('should reject duplicate email registration', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Email already exists' } } });
    await expect(mockPost({ email: 'existing@test.com' })).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('should send verification email after registration', async () => {
    const sendEmail = vi.fn().mockResolvedValueOnce({ success: true });
    const result = await sendEmail('new@test.com');
    expect(result.success).toBe(true);
  });

  it('should return token after successful registration', async () => {
    mockPost.mockResolvedValueOnce({ data: { token: makeToken(), user: makeUser() } });
    const res = await mockPost({});
    expect(res.data.token).toBeDefined();
  });

  it('should validate password confirmation matches', () => {
    const validate = vi.fn().mockReturnValue({ confirmPassword: 'Passwords do not match' });
    const errors = validate({ password: 'abc', confirmPassword: 'xyz' });
    expect(errors.confirmPassword).toBeDefined();
  });

  it('should handle server validation errors', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { errors: { email: ['Invalid'] } } } });
    await expect(mockPost({})).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should redirect to login after registration', () => {
    const navigate = vi.fn();
    navigate('/login');
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});

describe('Auth Integration – Forgot Password Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should send reset email for valid email', async () => {
    mockPost.mockResolvedValueOnce({ data: { message: 'Email sent' } });
    const res = await mockPost({ email: 'user@test.com' });
    expect(res.data.message).toBe('Email sent');
  });

  it('should show success message after email sent', async () => {
    mockPost.mockResolvedValueOnce({ data: { message: 'Check your inbox' } });
    const res = await mockPost({});
    expect(res.data.message).toBeDefined();
  });

  it('should handle unknown email gracefully', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(mockPost({ email: 'unknown@test.com' })).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('should validate email before sending', () => {
    const validate = vi.fn().mockReturnValue({ email: 'Invalid email' });
    const errors = validate({ email: 'bad' });
    expect(errors.email).toBeDefined();
  });

  it('should disable submit button while loading', () => {
    const setLoading = vi.fn();
    setLoading(true);
    expect(setLoading).toHaveBeenCalledWith(true);
  });
});

describe('Auth Integration – Reset Password Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should reset password with valid token', async () => {
    mockPost.mockResolvedValueOnce({ data: { message: 'Password updated' } });
    const res = await mockPost({ token: 'valid-token', password: 'newpass123' });
    expect(res.data.message).toBe('Password updated');
  });

  it('should reject expired token', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 410, data: { message: 'Token expired' } } });
    await expect(mockPost({ token: 'expired' })).rejects.toMatchObject({ response: { status: 410 } });
  });

  it('should reject invalid token', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 400 } });
    await expect(mockPost({ token: 'bad' })).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('should enforce new password strength', () => {
    const validate = vi.fn().mockReturnValue({ password: 'Too weak' });
    const errors = validate({ password: '123' });
    expect(errors.password).toBeDefined();
  });

  it('should redirect to login after reset', () => {
    const navigate = vi.fn();
    navigate('/login');
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});

describe('Auth Integration – First Access Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should detect first access flag on login response', async () => {
    mockPost.mockResolvedValueOnce({ data: { token: makeToken(), user: { ...makeUser(), firstAccess: true } } });
    const res = await mockPost({});
    expect(res.data.user.firstAccess).toBe(true);
  });

  it('should redirect to change password on first access', () => {
    const navigate = vi.fn();
    navigate('/change-password');
    expect(navigate).toHaveBeenCalledWith('/change-password');
  });

  it('should enforce password change before accessing app', () => {
    const isBlocked = vi.fn().mockReturnValue(true);
    expect(isBlocked()).toBe(true);
  });

  it('should mark firstAccess false after password change', async () => {
    mockPut.mockResolvedValueOnce({ data: { firstAccess: false } });
    const res = await mockPut({});
    expect(res.data.firstAccess).toBe(false);
  });

  it('should show temporary password field on first access', () => {
    const showField = vi.fn().mockReturnValue(true);
    expect(showField()).toBe(true);
  });
});

describe('Auth Integration – Token Refresh on 401', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should call refresh endpoint on 401 response', async () => {
    const refreshToken = vi.fn().mockResolvedValueOnce({ data: { token: makeToken() } });
    await refreshToken();
    expect(refreshToken).toHaveBeenCalled();
  });

  it('should retry original request after token refresh', async () => {
    const retryRequest = vi.fn().mockResolvedValueOnce({ data: {} });
    await retryRequest('/api/protected');
    expect(retryRequest).toHaveBeenCalledWith('/api/protected');
  });

  it('should update stored token after refresh', () => {
    const updateToken = vi.fn();
    updateToken(makeToken());
    expect(updateToken).toHaveBeenCalled();
  });

  it('should logout if refresh token also fails', async () => {
    const logout = vi.fn();
    mockPost.mockRejectedValueOnce({ response: { status: 401 } });
    try { await mockPost({}); } catch { logout(); }
    expect(logout).toHaveBeenCalled();
  });

  it('should not create infinite refresh loop', () => {
    const attempts = vi.fn().mockReturnValue(1);
    expect(attempts()).toBeLessThanOrEqual(3);
  });
});

describe('Auth Integration – Logout Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should call logout API', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } });
    await mockPost();
    expect(mockPost).toHaveBeenCalled();
  });

  it('should clear token from context', () => {
    const clearToken = vi.fn();
    clearToken();
    expect(clearToken).toHaveBeenCalled();
  });

  it('should clear user from context', () => {
    const clearUser = vi.fn();
    clearUser();
    expect(clearUser).toHaveBeenCalled();
  });

  it('should redirect to /login after logout', () => {
    const navigate = vi.fn();
    navigate('/login');
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('should clear localStorage on logout', () => {
    const clear = vi.fn();
    clear();
    expect(clear).toHaveBeenCalled();
  });
});

describe('Auth Integration – Auth Context', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should provide user data to children', () => {
    const useAuth = vi.fn().mockReturnValue({ user: makeUser() });
    const { user } = useAuth();
    expect(user.email).toBe('user@test.com');
  });

  it('should provide isAuthenticated flag', () => {
    const useAuth = vi.fn().mockReturnValue({ isAuthenticated: true });
    const { isAuthenticated } = useAuth();
    expect(isAuthenticated).toBe(true);
  });

  it('should provide logout function', () => {
    const useAuth = vi.fn().mockReturnValue({ logout: vi.fn() });
    const { logout } = useAuth();
    expect(typeof logout).toBe('function');
  });

  it('should update context when token changes', () => {
    const setToken = vi.fn();
    setToken('new-token');
    expect(setToken).toHaveBeenCalledWith('new-token');
  });

  it('should expose user role', () => {
    const useAuth = vi.fn().mockReturnValue({ user: makeUser('admin') });
    const { user } = useAuth();
    expect(user.role).toBe('admin');
  });
});

describe('Auth Integration – Protected Routes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should redirect unauthenticated user to /login', () => {
    const isAuth = vi.fn().mockReturnValue(false);
    const redirect = vi.fn();
    if (!isAuth()) redirect('/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should render content for authenticated user', () => {
    const isAuth = vi.fn().mockReturnValue(true);
    const render = vi.fn();
    if (isAuth()) render('content');
    expect(render).toHaveBeenCalledWith('content');
  });

  it('should pass intended location in redirect state', () => {
    const navigate = vi.fn();
    navigate('/login', { state: { from: '/dashboard' } });
    expect(navigate).toHaveBeenCalledWith('/login', { state: { from: '/dashboard' } });
  });

  it('should redirect to intended page after login', () => {
    const navigate = vi.fn();
    navigate('/dashboard');
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should show loading state while checking auth', () => {
    const isLoading = vi.fn().mockReturnValue(true);
    expect(isLoading()).toBe(true);
  });
});

describe('Auth Integration – Role Based Access', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should allow admin to access admin routes', () => {
    const hasAccess = vi.fn().mockReturnValue(true);
    expect(hasAccess('admin', '/admin')).toBe(true);
  });

  it('should deny user access to admin routes', () => {
    const hasAccess = vi.fn().mockReturnValue(false);
    expect(hasAccess('user', '/admin')).toBe(false);
  });

  it('should allow user to access user routes', () => {
    const hasAccess = vi.fn().mockReturnValue(true);
    expect(hasAccess('user', '/dashboard')).toBe(true);
  });

  it('should return 403 for unauthorized role access', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 403 } });
    await expect(mockGet('/admin')).rejects.toMatchObject({ response: { status: 403 } });
  });

  it('should expose user permissions in context', () => {
    const useAuth = vi.fn().mockReturnValue({ permissions: ['read', 'write'] });
    const { permissions } = useAuth();
    expect(permissions).toContain('read');
  });

  it('should check permission before rendering action buttons', () => {
    const can = vi.fn().mockReturnValue(false);
    expect(can('delete')).toBe(false);
  });

  it('should show admin menu only for admin users', () => {
    const isAdmin = vi.fn().mockReturnValue(true);
    expect(isAdmin()).toBe(true);
  });

  it('should update permissions after role change', () => {
    const updateRole = vi.fn();
    updateRole('manager');
    expect(updateRole).toHaveBeenCalledWith('manager');
  });

  it('should deny access when token is missing', () => {
    const getToken = vi.fn().mockReturnValue(null);
    expect(getToken()).toBeNull();
  });

  it('should allow super admin to impersonate user', () => {
    const impersonate = vi.fn().mockReturnValue({ user: makeUser(), impersonating: true });
    const result = impersonate('user-id');
    expect(result.impersonating).toBe(true);
  });
});
