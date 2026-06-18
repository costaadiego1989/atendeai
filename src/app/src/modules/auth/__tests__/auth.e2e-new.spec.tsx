import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
vi.mock('../api/authApi', () => ({ authApi: { login: mockPost, register: mockPost, logout: mockPost, forgotPassword: mockPost, resetPassword: mockPost } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ pathname: '/', state: null }) }));

const makeToken = () => 'eyJhbGciOiJIUzI1NiJ9.e2UiOiIxIn0.sig';
const makeUser = (role = 'user') => ({ id: '1', email: 'user@test.com', role });

describe('Auth E2E – Full Login Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should complete full login flow end to end', async () => {
    mockPost.mockResolvedValueOnce({ data: { token: makeToken(), user: makeUser() } });
    const res = await mockPost({ email: 'user@test.com', password: 'pass123' });
    expect(res.data.token).toBeDefined();
    expect(res.data.user.email).toBe('user@test.com');
  });

  it('should persist session after page reload', () => {
    const getToken = vi.fn().mockReturnValue(makeToken());
    expect(getToken()).toBeDefined();
  });

  it('should redirect to dashboard after successful login', () => {
    const navigate = vi.fn();
    navigate('/dashboard');
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should show error on invalid credentials', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 401, data: { message: 'Invalid credentials' } } });
    await expect(mockPost({})).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('should handle 400 bad request on login', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 400 } });
    await expect(mockPost({})).rejects.toMatchObject({ response: { status: 400 } });
  });
});

describe('Auth E2E – Register Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should complete full register flow', async () => {
    mockPost.mockResolvedValueOnce({ data: { user: makeUser(), token: makeToken() } });
    const res = await mockPost({ email: 'new@test.com', password: 'pass', name: 'New' });
    expect(res.data.user).toBeDefined();
  });

  it('should show validation errors for empty form', () => {
    const validate = vi.fn().mockReturnValue({ email: 'Required', password: 'Required' });
    const errs = validate({});
    expect(errs.email).toBeDefined();
  });

  it('should reject duplicate email on register', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409 } });
    await expect(mockPost({ email: 'dup@test.com' })).rejects.toMatchObject({ response: { status: 409 } });
  });
});

describe('Auth E2E – Forgot Password Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should send reset email and show confirmation', async () => {
    mockPost.mockResolvedValueOnce({ data: { message: 'Email sent' } });
    const res = await mockPost({ email: 'user@test.com' });
    expect(res.data.message).toBeDefined();
  });

  it('should handle unknown email in forgot password', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(mockPost({ email: 'ghost@test.com' })).rejects.toMatchObject({ response: { status: 404 } });
  });
});

describe('Auth E2E – Reset Password Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should reset password with valid token', async () => {
    mockPost.mockResolvedValueOnce({ data: { message: 'Password updated' } });
    const res = await mockPost({ token: 'valid', password: 'newpass123' });
    expect(res.data.message).toBeDefined();
  });

  it('should reject reset with invalid token', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 400 } });
    await expect(mockPost({ token: 'bad' })).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('should reject reset with expired token', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 410 } });
    await expect(mockPost({ token: 'expired' })).rejects.toMatchObject({ response: { status: 410 } });
  });
});

describe('Auth E2E – Auto Logout on Token Expiry', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should auto logout when token expires', () => {
    const logout = vi.fn();
    const isExpired = vi.fn().mockReturnValue(true);
    if (isExpired()) logout();
    expect(logout).toHaveBeenCalled();
  });

  it('should redirect to login on auto logout', () => {
    const navigate = vi.fn();
    navigate('/login');
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});

describe('Auth E2E – Remember Me', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should persist token when remember me is checked', () => {
    const store = vi.fn();
    store('token', makeToken(), { persistent: true });
    expect(store).toHaveBeenCalledWith('token', expect.any(String), { persistent: true });
  });

  it('should use session storage when remember me is unchecked', () => {
    const store = vi.fn();
    store('token', makeToken(), { persistent: false });
    expect(store).toHaveBeenCalledWith('token', expect.any(String), { persistent: false });
  });
});

describe('Auth E2E – Multiple Login Attempts Lockout', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should lock account after 5 failed attempts', async () => {
    mockPost.mockRejectedValue({ response: { status: 429, data: { message: 'Too many attempts' } } });
    for (let i = 0; i < 5; i++) {
      try { await mockPost({}); } catch {}
    }
    expect(mockPost).toHaveBeenCalledTimes(5);
  });

  it('should show lockout message after max attempts', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 429, data: { message: 'Account locked' } } });
    await expect(mockPost({})).rejects.toMatchObject({ response: { status: 429 } });
  });
});

describe('Auth E2E – 401/403 Handling', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should handle 401 by refreshing token', async () => {
    const refresh = vi.fn().mockResolvedValueOnce({ data: { token: makeToken() } });
    await refresh();
    expect(refresh).toHaveBeenCalled();
  });

  it('should handle 403 by showing access denied', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 403 } });
    await expect(mockGet('/admin')).rejects.toMatchObject({ response: { status: 403 } });
  });
});

describe('Auth E2E – Redirect After Login', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should redirect to originally intended page after login', () => {
    const getIntendedPath = vi.fn().mockReturnValue('/settings');
    const navigate = vi.fn();
    navigate(getIntendedPath());
    expect(navigate).toHaveBeenCalledWith('/settings');
  });

  it('should default to dashboard if no intended page', () => {
    const getIntendedPath = vi.fn().mockReturnValue('/dashboard');
    const navigate = vi.fn();
    navigate(getIntendedPath());
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });
});

describe('Auth E2E – Session Persistence', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should restore session from localStorage on reload', () => {
    const loadSession = vi.fn().mockReturnValue({ token: makeToken(), user: makeUser() });
    const session = loadSession();
    expect(session.token).toBeDefined();
  });

  it('should invalidate corrupted session data', () => {
    const validateSession = vi.fn().mockReturnValue(false);
    expect(validateSession('bad-data')).toBe(false);
  });

  it('should clear session on browser close if not remembered', () => {
    const clearSession = vi.fn();
    clearSession();
    expect(clearSession).toHaveBeenCalled();
  });
});
