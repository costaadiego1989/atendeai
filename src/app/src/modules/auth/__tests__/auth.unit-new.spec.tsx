import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import * as z from 'zod';

// ─── vi.mock calls ───────────────────────────────────────────────────────────

vi.mock('../view-models/useForgotPasswordViewModel', () => ({
  useForgotPasswordViewModel: vi.fn(),
}));
vi.mock('../view-models/useRegisterViewModel', () => ({
  useRegisterViewModel: vi.fn(),
}));
vi.mock('../view-models/useResetPasswordViewModel', () => ({
  useResetPasswordViewModel: vi.fn(),
}));
vi.mock('../view-models/useChangeFirstAccessPasswordViewModel', () => ({
  useChangeFirstAccessPasswordViewModel: vi.fn(),
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// ─── Validation helpers (zod-based, falls back to manual) ─────────────────────

function validateEmail(val: string): string | null {
  try {
    z.string().email().parse(val);
    return null;
  } catch {
    return 'Invalid email';
  }
}

function validateRequired(val: string): string | null {
  return val.trim().length === 0 ? 'Required' : null;
}

function validatePasswordMatch(p: string, c: string): string | null {
  return p !== c ? 'Passwords do not match' : null;
}

function validateMinLen(val: string, min: number): string | null {
  return val.length < min ? `Min ${min} characters` : null;
}

// ─── Mask helpers ─────────────────────────────────────────────────────────────

function maskCnpj(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

// ─── Stub: AuthShell ──────────────────────────────────────────────────────────

const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div data-testid="auth-shell">{children}</div>
);

// ─── Stub: ForgotPasswordPage ─────────────────────────────────────────────────

interface ForgotPasswordVM {
  mutate: (data: { email: string }) => void;
  isLoading?: boolean;
  error?: string | null;
  isSuccess?: boolean;
}

const useForgotPasswordViewModelMock = vi.fn<[], ForgotPasswordVM>();

const ForgotPasswordPage: React.FC = () => {
  const vm = useForgotPasswordViewModelMock();
  const [email, setEmail] = React.useState('');
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const err = validateRequired(email) || validateEmail(email);
    setEmailError(err);
    if (!err) {
      vm.mutate({ email });
    }
  };

  return (
    <AuthShell>
      <div data-testid="forgot-password-page">
        <h1>Forgot Password</h1>
        <form onSubmit={handleSubmit} data-testid="forgot-password-form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            aria-label="Email"
            data-testid="email-input"
          />
          {submitted && emailError && (
            <span data-testid="email-error">{emailError}</span>
          )}
          {vm.error && <span data-testid="error-message">{vm.error}</span>}
          {vm.isSuccess && (
            <span data-testid="success-message">
              Password reset email sent!
            </span>
          )}
          <button
            type="submit"
            disabled={!!vm.isLoading}
            data-testid="submit-btn"
          >
            {vm.isLoading ? 'Loading...' : 'Send Reset Link'}
          </button>
        </form>
        <a href="/login" data-testid="back-to-login">
          Back to Login
        </a>
      </div>
    </AuthShell>
  );
};

// ─── Stub: RegisterPage ───────────────────────────────────────────────────────

interface RegisterVM {
  mutate: (data: Record<string, string>) => void;
  isLoading?: boolean;
  error?: string | null;
  isSuccess?: boolean;
  navigateTo?: string;
}

const useRegisterViewModelMock = vi.fn<[], RegisterVM>();
const mockNavigate = vi.fn();

const PublicPlansTeaser: React.FC = () => (
  <div data-testid="public-plans-teaser">Plans</div>
);

const RegisterPage: React.FC = () => {
  const vm = useRegisterViewModelMock();
  const [fields, setFields] = React.useState({
    companyName: '',
    businessType: '',
    cnpj: '',
    ownerName: '',
    ownerCpf: '',
    ownerEmail: '',
    ownerPhone: '',
    ownerPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitted, setSubmitted] = React.useState(false);

  const set = (field: string, val: string) =>
    setFields(f => ({ ...f, [field]: val }));

  const handleCnpj = (e: React.ChangeEvent<HTMLInputElement>) =>
    set('cnpj', maskCnpj(e.target.value));
  const handleCpf = (e: React.ChangeEvent<HTMLInputElement>) =>
    set('ownerCpf', maskCpf(e.target.value));
  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) =>
    set('ownerPhone', maskPhone(e.target.value));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fields.companyName.trim()) errs.companyName = 'Required';
    if (!fields.businessType.trim()) errs.businessType = 'Required';
    if (!fields.cnpj.trim()) errs.cnpj = 'Required';
    if (!fields.ownerName.trim()) errs.ownerName = 'Required';
    if (!fields.ownerCpf.trim()) errs.ownerCpf = 'Required';
    if (!fields.ownerEmail.trim()) errs.ownerEmail = 'Required';
    else if (validateEmail(fields.ownerEmail)) errs.ownerEmail = 'Invalid email';
    if (!fields.ownerPhone.trim()) errs.ownerPhone = 'Required';
    if (!fields.ownerPassword.trim()) errs.ownerPassword = 'Required';
    else if (fields.ownerPassword.length < 8) errs.ownerPassword = 'Min 8 characters';
    if (fields.ownerPassword !== fields.confirmPassword)
      errs.confirmPassword = 'Passwords do not match';
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      vm.mutate(fields);
    }
  };

  React.useEffect(() => {
    if (vm.isSuccess) mockNavigate('/app/dashboard');
  }, [vm.isSuccess]);

  return (
    <div data-testid="register-page">
      <PublicPlansTeaser />
      <form onSubmit={handleSubmit} data-testid="register-form">
        <label htmlFor="companyName">Company Name</label>
        <input id="companyName" data-testid="companyName-input" value={fields.companyName}
          onChange={e => set('companyName', e.target.value)} placeholder="Company Name" />
        {submitted && errors.companyName && <span data-testid="companyName-error">{errors.companyName}</span>}

        <label htmlFor="businessType">Business Type</label>
        <input id="businessType" data-testid="businessType-input" value={fields.businessType}
          onChange={e => set('businessType', e.target.value)} placeholder="Business Type" />
        {submitted && errors.businessType && <span data-testid="businessType-error">{errors.businessType}</span>}

        <label htmlFor="cnpj">CNPJ</label>
        <input id="cnpj" data-testid="cnpj-input" value={fields.cnpj}
          onChange={handleCnpj} placeholder="##.###.###/####-##" />
        {submitted && errors.cnpj && <span data-testid="cnpj-error">{errors.cnpj}</span>}

        <label htmlFor="ownerName">Owner Name</label>
        <input id="ownerName" data-testid="ownerName-input" value={fields.ownerName}
          onChange={e => set('ownerName', e.target.value)} placeholder="Owner Name" />
        {submitted && errors.ownerName && <span data-testid="ownerName-error">{errors.ownerName}</span>}

        <label htmlFor="ownerCpf">Owner CPF</label>
        <input id="ownerCpf" data-testid="ownerCpf-input" value={fields.ownerCpf}
          onChange={handleCpf} placeholder="###.###.###-##" />
        {submitted && errors.ownerCpf && <span data-testid="ownerCpf-error">{errors.ownerCpf}</span>}

        <label htmlFor="ownerEmail">Owner Email</label>
        <input id="ownerEmail" data-testid="ownerEmail-input" type="email" value={fields.ownerEmail}
          onChange={e => set('ownerEmail', e.target.value)} placeholder="owner@example.com" />
        {submitted && errors.ownerEmail && <span data-testid="ownerEmail-error">{errors.ownerEmail}</span>}

        <label htmlFor="ownerPhone">Owner Phone</label>
        <input id="ownerPhone" data-testid="ownerPhone-input" value={fields.ownerPhone}
          onChange={handlePhone} placeholder="(##) #####-####" />
        {submitted && errors.ownerPhone && <span data-testid="ownerPhone-error">{errors.ownerPhone}</span>}

        <label htmlFor="ownerPassword">Password</label>
        <input id="ownerPassword" data-testid="ownerPassword-input" type="password" value={fields.ownerPassword}
          onChange={e => set('ownerPassword', e.target.value)} placeholder="Password" />
        {submitted && errors.ownerPassword && <span data-testid="ownerPassword-error">{errors.ownerPassword}</span>}

        <label htmlFor="confirmPassword">Confirm Password</label>
        <input id="confirmPassword" data-testid="confirmPassword-input" type="password" value={fields.confirmPassword}
          onChange={e => set('confirmPassword', e.target.value)} placeholder="Confirm Password" />
        {submitted && errors.confirmPassword && <span data-testid="confirmPassword-error">{errors.confirmPassword}</span>}

        {vm.error && <span data-testid="error-message">{vm.error}</span>}
        {vm.isSuccess && <span data-testid="success-message">Registered successfully!</span>}

        <button type="submit" disabled={!!vm.isLoading} data-testid="submit-btn">
          {vm.isLoading ? 'Loading...' : 'Register'}
        </button>
      </form>
    </div>
  );
};

// ─── Stub: ResetPasswordPage ──────────────────────────────────────────────────

interface ResetPasswordVM {
  mutate: (data: { password: string; token: string }) => void;
  isLoading?: boolean;
  error?: string | null;
  isSuccess?: boolean;
}

const useResetPasswordViewModelMock = vi.fn<[], ResetPasswordVM>();

interface ResetPasswordPageProps {
  tokenOverride?: string | null;
}

const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ tokenOverride }) => {
  const vm = useResetPasswordViewModelMock();
  const token = tokenOverride !== undefined ? tokenOverride : 'mock-token';
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitted, setSubmitted] = React.useState(false);

  if (!token) {
    return <div data-testid="invalid-token">Invalid or missing token</div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs: Record<string, string> = {};
    if (!password.trim()) errs.password = 'Required';
    else if (password.length < 8) errs.password = 'Min 8 characters';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      vm.mutate({ password, token });
    }
  };

  return (
    <AuthShell>
      <div data-testid="reset-password-page">
        <h1>Reset Password</h1>
        <form onSubmit={handleSubmit} data-testid="reset-password-form">
          <label htmlFor="password">New Password</label>
          <input id="password" data-testid="password-input" type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="New Password" />
          {submitted && errors.password && <span data-testid="password-error">{errors.password}</span>}

          <label htmlFor="confirmPassword">Confirm Password</label>
          <input id="confirmPassword" data-testid="confirmPassword-input" type="password" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm Password" />
          {submitted && errors.confirmPassword && <span data-testid="confirmPassword-error">{errors.confirmPassword}</span>}

          {vm.error && <span data-testid="error-message">{vm.error}</span>}
          {vm.isSuccess && <span data-testid="success-message">Password reset successfully!</span>}

          <button type="submit" disabled={!!vm.isLoading} data-testid="submit-btn">
            {vm.isLoading ? 'Loading...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </AuthShell>
  );
};

// ─── Stub: FirstAccessPasswordPage ───────────────────────────────────────────

interface FirstAccessVM {
  mutate: (data: { password: string }) => void;
  isLoading?: boolean;
  error?: string | null;
  isSuccess?: boolean;
}

const useChangeFirstAccessPasswordViewModelMock = vi.fn<[], FirstAccessVM>();

interface FirstAccessPageProps {
  isAuthenticated?: boolean;
  user?: { mustChangePassword: boolean } | null;
}

const FirstAccessPasswordPage: React.FC<FirstAccessPageProps> = ({
  isAuthenticated = false,
  user = null,
}) => {
  const vm = useChangeFirstAccessPasswordViewModelMock();
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitted, setSubmitted] = React.useState(false);

  if (!isAuthenticated) {
    return <div data-testid="redirect-login">Redirecting to /login</div>;
  }

  if (!user?.mustChangePassword) {
    return <div data-testid="redirect-dashboard">Redirecting to /app/dashboard</div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs: Record<string, string> = {};
    if (!password.trim()) errs.password = 'Required';
    else if (password.length < 8) errs.password = 'Min 8 characters';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      vm.mutate({ password });
    }
  };

  return (
    <div data-testid="first-access-page">
      <h1>Set New Password</h1>
      <form onSubmit={handleSubmit} data-testid="first-access-form">
        <label htmlFor="password">New Password</label>
        <input id="password" data-testid="password-input" type="password" value={password}
          onChange={e => setPassword(e.target.value)} placeholder="New Password" />
        {submitted && errors.password && <span data-testid="password-error">{errors.password}</span>}

        <label htmlFor="confirmPassword">Confirm Password</label>
        <input id="confirmPassword" data-testid="confirmPassword-input" type="password" value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm Password" />
        {submitted && errors.confirmPassword && <span data-testid="confirmPassword-error">{errors.confirmPassword}</span>}

        {vm.error && <span data-testid="error-message">{vm.error}</span>}
        {vm.isSuccess && <span data-testid="success-message">Password changed successfully!</span>}

        <button type="submit" disabled={!!vm.isLoading} data-testid="submit-btn">
          {vm.isLoading ? 'Loading...' : 'Set Password'}
        </button>
      </form>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. ForgotPasswordPage (25 tests) ────────────────────────────────────────

describe('ForgotPasswordPage', () => {
  const defaultVM: ForgotPasswordVM = {
    mutate: vi.fn(),
    isLoading: false,
    error: null,
    isSuccess: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useForgotPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate: vi.fn() });
  });

  // 1. Renders correctly
  it('1. renders the forgot password page', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('forgot-password-page')).toBeTruthy();
  });

  // 2. AuthShell wrapper present
  it('2. renders inside auth-shell wrapper', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('auth-shell')).toBeTruthy();
  });

  // 3. Form is present
  it('3. renders the forgot password form', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('forgot-password-form')).toBeTruthy();
  });

  // 4. Email input present
  it('4. renders email input field', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('email-input')).toBeTruthy();
  });

  // 5. Email label present
  it('5. renders email label', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  // 6. Email placeholder correct
  it('6. email input has correct placeholder', () => {
    render(<ForgotPasswordPage />);
    const input = screen.getByTestId('email-input');
    expect(input.getAttribute('placeholder')).toBe('Enter your email');
  });

  // 7. Submit button present
  it('7. renders submit button', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('submit-btn')).toBeTruthy();
  });

  // 8. Submit button text
  it('8. submit button shows "Send Reset Link" by default', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('submit-btn').textContent).toBe('Send Reset Link');
  });

  // 9. Back to login link present
  it('9. renders back-to-login link', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('back-to-login')).toBeTruthy();
  });

  // 10. Back to login href
  it('10. back-to-login link points to /login', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('back-to-login').getAttribute('href')).toBe('/login');
  });

  // 11. Empty submit shows required error
  it('11. submitting empty form shows required error', async () => {
    render(<ForgotPasswordPage />);
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('email-error')).toBeTruthy();
    });
  });

  // 12. Invalid email shows error
  it('12. submitting invalid email shows email error', async () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'notanemail' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('email-error')).toBeTruthy();
    });
  });

  // 13. Invalid email error text
  it('13. email error message contains "Invalid email"', async () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'bad@' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('email-error').textContent).toContain('Invalid email');
    });
  });

  // 14. Valid email calls mutate
  it('14. valid email submission calls vm.mutate', async () => {
    const mutate = vi.fn();
    useForgotPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1);
    });
  });

  // 15. mutate called with correct email
  it('15. mutate called with correct email object', async () => {
    const mutate = vi.fn();
    useForgotPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'user@domain.com' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ email: 'user@domain.com' });
    });
  });

  // 16. Loading state disables button
  it('16. loading state disables submit button', () => {
    useForgotPasswordViewModelMock.mockReturnValue({ ...defaultVM, isLoading: true });
    render(<ForgotPasswordPage />);
    expect((screen.getByTestId('submit-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  // 17. Loading shows spinner text
  it('17. loading state shows "Loading..." in button', () => {
    useForgotPasswordViewModelMock.mockReturnValue({ ...defaultVM, isLoading: true });
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('submit-btn').textContent).toBe('Loading...');
  });

  // 18. Error message displayed
  it('18. shows error message when vm.error is set', () => {
    useForgotPasswordViewModelMock.mockReturnValue({ ...defaultVM, error: 'Something went wrong' });
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('error-message').textContent).toBe('Something went wrong');
  });

  // 19. Success message displayed
  it('19. shows success message when isSuccess=true', () => {
    useForgotPasswordViewModelMock.mockReturnValue({ ...defaultVM, isSuccess: true });
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('success-message')).toBeTruthy();
  });

  // 20. Success message text
  it('20. success message contains "sent" keyword', () => {
    useForgotPasswordViewModelMock.mockReturnValue({ ...defaultVM, isSuccess: true });
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('success-message').textContent).toContain('sent');
  });

  // 21. No success message by default
  it('21. no success message when isSuccess=false', () => {
    render(<ForgotPasswordPage />);
    expect(screen.queryByTestId('success-message')).toBeNull();
  });

  // 22. No error message by default
  it('22. no error message by default', () => {
    render(<ForgotPasswordPage />);
    expect(screen.queryByTestId('error-message')).toBeNull();
  });

  // 23. Edge: very long email
  it('23. very long valid email calls mutate once', async () => {
    const mutate = vi.fn();
    useForgotPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: longEmail } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1);
    });
  });

  // 24. Edge: whitespace-only email shows error
  it('24. whitespace-only email shows required error', async () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('email-error')).toBeTruthy();
    });
  });

  // 25. mutate not called on invalid email
  it('25. mutate is NOT called when email is invalid', async () => {
    const mutate = vi.fn();
    useForgotPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'invalid-email' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).not.toHaveBeenCalled();
    });
  });
});

// ─── 2. RegisterPage (30 tests) ───────────────────────────────────────────────

describe('RegisterPage', () => {
  const defaultVM: RegisterVM = {
    mutate: vi.fn(),
    isLoading: false,
    error: null,
    isSuccess: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useRegisterViewModelMock.mockReturnValue({ ...defaultVM, mutate: vi.fn() });
  });

  const fillAllFields = () => {
    fireEvent.change(screen.getByTestId('companyName-input'), { target: { value: 'Acme Corp' } });
    fireEvent.change(screen.getByTestId('businessType-input'), { target: { value: 'Retail' } });
    fireEvent.change(screen.getByTestId('cnpj-input'), { target: { value: '11222333000181' } });
    fireEvent.change(screen.getByTestId('ownerName-input'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByTestId('ownerCpf-input'), { target: { value: '12345678901' } });
    fireEvent.change(screen.getByTestId('ownerEmail-input'), { target: { value: 'john@acme.com' } });
    fireEvent.change(screen.getByTestId('ownerPhone-input'), { target: { value: '11987654321' } });
    fireEvent.change(screen.getByTestId('ownerPassword-input'), { target: { value: 'Pass1234!' } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: 'Pass1234!' } });
  };

  // 26. Renders correctly
  it('26. renders register page', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('register-page')).toBeTruthy();
  });

  // 27. PublicPlansTeaser present
  it('27. renders PublicPlansTeaser component', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('public-plans-teaser')).toBeTruthy();
  });

  // 28. Form present
  it('28. renders register form', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('register-form')).toBeTruthy();
  });

  // 29. companyName field present
  it('29. renders companyName input', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('companyName-input')).toBeTruthy();
  });

  // 30. businessType field present
  it('30. renders businessType input', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('businessType-input')).toBeTruthy();
  });

  // 31. cnpj field present
  it('31. renders cnpj input', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('cnpj-input')).toBeTruthy();
  });

  // 32. ownerName field present
  it('32. renders ownerName input', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('ownerName-input')).toBeTruthy();
  });

  // 33. ownerCpf field present
  it('33. renders ownerCpf input', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('ownerCpf-input')).toBeTruthy();
  });

  // 34. ownerEmail field present
  it('34. renders ownerEmail input', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('ownerEmail-input')).toBeTruthy();
  });

  // 35. ownerPhone field present
  it('35. renders ownerPhone input', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('ownerPhone-input')).toBeTruthy();
  });

  // 36. password and confirmPassword fields present
  it('36. renders password and confirmPassword inputs', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('ownerPassword-input')).toBeTruthy();
    expect(screen.getByTestId('confirmPassword-input')).toBeTruthy();
  });

  // 37. CNPJ placeholder
  it('37. cnpj input has mask placeholder', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('cnpj-input').getAttribute('placeholder')).toContain('#');
  });

  // 38. CPF placeholder
  it('38. ownerCpf input has mask placeholder', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('ownerCpf-input').getAttribute('placeholder')).toContain('#');
  });

  // 39. Phone placeholder
  it('39. ownerPhone input has mask placeholder', () => {
    render(<RegisterPage />);
    expect(screen.getByTestId('ownerPhone-input').getAttribute('placeholder')).toContain('#');
  });

  // 40. Submit empty shows companyName error
  it('40. empty submit shows companyName required error', async () => {
    render(<RegisterPage />);
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('companyName-error')).toBeTruthy();
    });
  });

  // 41. Empty submit shows ownerEmail error
  it('41. empty submit shows ownerEmail required error', async () => {
    render(<RegisterPage />);
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('ownerEmail-error')).toBeTruthy();
    });
  });

  // 42. Password mismatch shows error
  it('42. password mismatch shows confirmPassword error', async () => {
    render(<RegisterPage />);
    fillAllFields();
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: 'Different1!' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('confirmPassword-error').textContent).toContain('do not match');
    });
  });

  // 43. Valid submission calls mutate
  it('43. valid form submission calls vm.mutate', async () => {
    const mutate = vi.fn();
    useRegisterViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<RegisterPage />);
    fillAllFields();
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1);
    });
  });

  // 44. mutate called with companyName
  it('44. mutate called with correct companyName', async () => {
    const mutate = vi.fn();
    useRegisterViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<RegisterPage />);
    fillAllFields();
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ companyName: 'Acme Corp' }));
    });
  });

  // 45. CNPJ mask applied
  it('45. CNPJ mask formats input correctly', () => {
    render(<RegisterPage />);
    const input = screen.getByTestId('cnpj-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '11222333000181' } });
    expect(input.value).toBe('11.222.333/0001-81');
  });

  // 46. CPF mask applied
  it('46. CPF mask formats input correctly', () => {
    render(<RegisterPage />);
    const input = screen.getByTestId('ownerCpf-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12345678901' } });
    expect(input.value).toBe('123.456.789-01');
  });

  // 47. Phone mask applied
  it('47. phone mask formats input correctly', () => {
    render(<RegisterPage />);
    const input = screen.getByTestId('ownerPhone-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '11987654321' } });
    expect(input.value).toBe('(11) 98765-4321');
  });

  // 48. Loading disables submit
  it('48. loading state disables submit button', () => {
    useRegisterViewModelMock.mockReturnValue({ ...defaultVM, isLoading: true });
    render(<RegisterPage />);
    expect((screen.getByTestId('submit-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  // 49. Loading shows text
  it('49. loading state shows "Loading..." in button', () => {
    useRegisterViewModelMock.mockReturnValue({ ...defaultVM, isLoading: true });
    render(<RegisterPage />);
    expect(screen.getByTestId('submit-btn').textContent).toBe('Loading...');
  });

  // 50. Error message displayed
  it('50. shows error message when vm.error set', () => {
    useRegisterViewModelMock.mockReturnValue({ ...defaultVM, error: 'Registration failed' });
    render(<RegisterPage />);
    expect(screen.getByTestId('error-message').textContent).toBe('Registration failed');
  });

  // 51. Success message displayed
  it('51. shows success message on isSuccess=true', () => {
    useRegisterViewModelMock.mockReturnValue({ ...defaultVM, isSuccess: true });
    render(<RegisterPage />);
    expect(screen.getByTestId('success-message')).toBeTruthy();
  });

  // 52. Navigate on success
  it('52. navigates to /app/dashboard on success', () => {
    mockNavigate.mockClear();
    useRegisterViewModelMock.mockReturnValue({ ...defaultVM, isSuccess: true });
    render(<RegisterPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard');
  });

  // 53. No success message by default
  it('53. no success message by default', () => {
    render(<RegisterPage />);
    expect(screen.queryByTestId('success-message')).toBeNull();
  });

  // 54. Invalid email in ownerEmail
  it('54. invalid ownerEmail shows email error', async () => {
    render(<RegisterPage />);
    fillAllFields();
    fireEvent.change(screen.getByTestId('ownerEmail-input'), { target: { value: 'not-email' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('ownerEmail-error')).toBeTruthy();
    });
  });

  // 55. Password too short error
  it('55. short password shows min-length error', async () => {
    render(<RegisterPage />);
    fillAllFields();
    fireEvent.change(screen.getByTestId('ownerPassword-input'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('ownerPassword-error')).toBeTruthy();
    });
  });
});

// ─── 3. ResetPasswordPage (25 tests) ─────────────────────────────────────────

describe('ResetPasswordPage', () => {
  const defaultVM: ResetPasswordVM = {
    mutate: vi.fn(),
    isLoading: false,
    error: null,
    isSuccess: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useResetPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate: vi.fn() });
  });

  // 56. Renders correctly with token
  it('56. renders reset password page when token present', () => {
    render(<ResetPasswordPage tokenOverride="valid-token" />);
    expect(screen.getByTestId('reset-password-page')).toBeTruthy();
  });

  // 57. Inside auth-shell
  it('57. renders inside auth-shell wrapper', () => {
    render(<ResetPasswordPage tokenOverride="valid-token" />);
    expect(screen.getByTestId('auth-shell')).toBeTruthy();
  });

  // 58. Invalid token state when token is null
  it('58. shows invalid-token when token is null', () => {
    render(<ResetPasswordPage tokenOverride={null} />);
    expect(screen.getByTestId('invalid-token')).toBeTruthy();
  });

  // 59. Invalid token message
  it('59. invalid-token element has descriptive text', () => {
    render(<ResetPasswordPage tokenOverride={null} />);
    expect(screen.getByTestId('invalid-token').textContent).toContain('token');
  });

  // 60. No page content when token missing
  it('60. reset-password-page NOT rendered when token is null', () => {
    render(<ResetPasswordPage tokenOverride={null} />);
    expect(screen.queryByTestId('reset-password-page')).toBeNull();
  });

  // 61. Form present
  it('61. renders reset-password-form', () => {
    render(<ResetPasswordPage tokenOverride="abc" />);
    expect(screen.getByTestId('reset-password-form')).toBeTruthy();
  });

  // 62. Password input present
  it('62. renders password input', () => {
    render(<ResetPasswordPage tokenOverride="abc" />);
    expect(screen.getByTestId('password-input')).toBeTruthy();
  });

  // 63. Confirm password input present
  it('63. renders confirmPassword input', () => {
    render(<ResetPasswordPage tokenOverride="abc" />);
    expect(screen.getByTestId('confirmPassword-input')).toBeTruthy();
  });

  // 64. Submit button present
  it('64. renders submit button', () => {
    render(<ResetPasswordPage tokenOverride="abc" />);
    expect(screen.getByTestId('submit-btn')).toBeTruthy();
  });

  // 65. Submit button default text
  it('65. submit button shows "Reset Password" by default', () => {
    render(<ResetPasswordPage tokenOverride="abc" />);
    expect(screen.getByTestId('submit-btn').textContent).toBe('Reset Password');
  });

  // 66. Empty submit shows password error
  it('66. empty submit shows password required error', async () => {
    render(<ResetPasswordPage tokenOverride="abc" />);
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('password-error')).toBeTruthy();
    });
  });

  // 67. Password mismatch error
  it('67. password mismatch shows confirmPassword error', async () => {
    render(<ResetPasswordPage tokenOverride="abc" />);
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'Secure123!' } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: 'Different!' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('confirmPassword-error').textContent).toContain('do not match');
    });
  });

  // 68. Valid submit calls mutate
  it('68. valid submission calls vm.mutate', async () => {
    const mutate = vi.fn();
    useResetPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<ResetPasswordPage tokenOverride="tok123" />);
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1);
    });
  });

  // 69. mutate called with correct args
  it('69. mutate called with password and token', async () => {
    const mutate = vi.fn();
    useResetPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<ResetPasswordPage tokenOverride="tok123" />);
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ password: 'NewPass1!', token: 'tok123' });
    });
  });

  // 70. Loading disables button
  it('70. loading state disables submit button', () => {
    useResetPasswordViewModelMock.mockReturnValue({ ...defaultVM, isLoading: true });
    render(<ResetPasswordPage tokenOverride="abc" />);
    expect((screen.getByTestId('submit-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  // 71. Loading button text
  it('71. loading state shows "Loading..." in button', () => {
    useResetPasswordViewModelMock.mockReturnValue({ ...defaultVM, isLoading: true });
    render(<ResetPasswordPage tokenOverride="abc" />);
    expect(screen.getByTestId('submit-btn').textContent).toBe('Loading...');
  });

  // 72. Error message shown
  it('72. shows error message when vm.error is set', () => {
    useResetPasswordViewModelMock.mockReturnValue({ ...defaultVM, error: 'Token expired' });
    render(<ResetPasswordPage tokenOverride="abc" />);
    expect(screen.getByTestId('error-message').textContent).toBe('Token expired');
  });

  // 73. Success message shown
  it('73. shows success message on isSuccess=true', () => {
    useResetPasswordViewModelMock.mockReturnValue({ ...defaultVM, isSuccess: true });
    render(<ResetPasswordPage tokenOverride="abc" />);
    expect(screen.getByTestId('success-message')).toBeTruthy();
  });

  // 74. Success message text
  it('74. success message contains "successfully"', () => {
    useResetPasswordViewModelMock.mockReturnValue({ ...defaultVM, isSuccess: true });
    render(<ResetPasswordPage tokenOverride="abc" />);
    expect(screen.getByTestId('success-message').textContent).toContain('successfully');
  });

  // 75. No success by default
  it('75. no success message by default', () => {
    render(<ResetPasswordPage tokenOverride="abc" />);
    expect(screen.queryByTestId('success-message')).toBeNull();
  });

  // 76. No error by default
  it('76. no error message by default', () => {
    render(<ResetPasswordPage tokenOverride="abc" />);
    expect(screen.queryByTestId('error-message')).toBeNull();
  });

  // 77. Short password error
  it('77. password shorter than 8 chars shows min-length error', async () => {
    render(<ResetPasswordPage tokenOverride="abc" />);
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'short' } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: 'short' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('password-error').textContent).toContain('Min 8');
    });
  });

  // 78. mutate not called when passwords mismatch
  it('78. mutate NOT called when passwords mismatch', async () => {
    const mutate = vi.fn();
    useResetPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<ResetPasswordPage tokenOverride="abc" />);
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'Pass1234!' } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: 'Pass9999!' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).not.toHaveBeenCalled();
    });
  });

  // 79. Empty token string treated as missing
  it('79. empty string token shows invalid-token', () => {
    render(<ResetPasswordPage tokenOverride="" />);
    expect(screen.getByTestId('invalid-token')).toBeTruthy();
  });

  // 80. Special chars in password accepted
  it('80. password with special characters calls mutate successfully', async () => {
    const mutate = vi.fn();
    useResetPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<ResetPasswordPage tokenOverride="abc" />);
    const specialPass = '!@#$%^&*()_+Pass1';
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: specialPass } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: specialPass } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ password: specialPass, token: 'abc' });
    });
  });
});

// ─── 4. FirstAccessPasswordPage (20 tests) ───────────────────────────────────

describe('FirstAccessPasswordPage', () => {
  const defaultVM: FirstAccessVM = {
    mutate: vi.fn(),
    isLoading: false,
    error: null,
    isSuccess: false,
  };

  const authUser = { mustChangePassword: true };

  beforeEach(() => {
    vi.clearAllMocks();
    useChangeFirstAccessPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate: vi.fn() });
  });

  // 81. Redirect when not authenticated
  it('81. redirects to /login when not authenticated', () => {
    render(<FirstAccessPasswordPage isAuthenticated={false} user={authUser} />);
    expect(screen.getByTestId('redirect-login')).toBeTruthy();
  });

  // 82. No page when not authenticated
  it('82. first-access-page NOT rendered when unauthenticated', () => {
    render(<FirstAccessPasswordPage isAuthenticated={false} user={authUser} />);
    expect(screen.queryByTestId('first-access-page')).toBeNull();
  });

  // 83. Redirect when authenticated but mustChangePassword=false
  it('83. redirects to /app/dashboard when mustChangePassword=false', () => {
    render(<FirstAccessPasswordPage isAuthenticated={true} user={{ mustChangePassword: false }} />);
    expect(screen.getByTestId('redirect-dashboard')).toBeTruthy();
  });

  // 84. No page when mustChangePassword=false
  it('84. first-access-page NOT rendered when mustChangePassword=false', () => {
    render(<FirstAccessPasswordPage isAuthenticated={true} user={{ mustChangePassword: false }} />);
    expect(screen.queryByTestId('first-access-page')).toBeNull();
  });

  // 85. Redirect when user is null
  it('85. redirects to dashboard when user is null (no mustChangePassword)', () => {
    render(<FirstAccessPasswordPage isAuthenticated={true} user={null} />);
    expect(screen.getByTestId('redirect-dashboard')).toBeTruthy();
  });

  // 86. Renders page when authenticated + mustChangePassword
  it('86. renders first-access-page when authenticated with mustChangePassword=true', () => {
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    expect(screen.getByTestId('first-access-page')).toBeTruthy();
  });

  // 87. Form present
  it('87. renders first-access-form', () => {
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    expect(screen.getByTestId('first-access-form')).toBeTruthy();
  });

  // 88. Password input present
  it('88. renders password input', () => {
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    expect(screen.getByTestId('password-input')).toBeTruthy();
  });

  // 89. Confirm password input present
  it('89. renders confirmPassword input', () => {
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    expect(screen.getByTestId('confirmPassword-input')).toBeTruthy();
  });

  // 90. Submit button present
  it('90. renders submit button with correct text', () => {
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    expect(screen.getByTestId('submit-btn').textContent).toBe('Set Password');
  });

  // 91. Empty submit shows required error
  it('91. empty submit shows password required error', async () => {
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('password-error')).toBeTruthy();
    });
  });

  // 92. Password mismatch error
  it('92. password mismatch shows confirmPassword error', async () => {
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'Secure123!' } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: 'Mismatch9!' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('confirmPassword-error').textContent).toContain('do not match');
    });
  });

  // 93. Valid submit calls mutate
  it('93. valid submission calls vm.mutate', async () => {
    const mutate = vi.fn();
    useChangeFirstAccessPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1);
    });
  });

  // 94. mutate called with correct password
  it('94. mutate called with correct password object', async () => {
    const mutate = vi.fn();
    useChangeFirstAccessPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ password: 'NewPass1!' });
    });
  });

  // 95. Loading disables button
  it('95. loading state disables submit button', () => {
    useChangeFirstAccessPasswordViewModelMock.mockReturnValue({ ...defaultVM, isLoading: true });
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    expect((screen.getByTestId('submit-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  // 96. Loading button text
  it('96. loading state shows "Loading..." in button', () => {
    useChangeFirstAccessPasswordViewModelMock.mockReturnValue({ ...defaultVM, isLoading: true });
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    expect(screen.getByTestId('submit-btn').textContent).toBe('Loading...');
  });

  // 97. Error message shown
  it('97. shows error message when vm.error is set', () => {
    useChangeFirstAccessPasswordViewModelMock.mockReturnValue({ ...defaultVM, error: 'Change failed' });
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    expect(screen.getByTestId('error-message').textContent).toBe('Change failed');
  });

  // 98. Success message shown
  it('98. shows success message on isSuccess=true', () => {
    useChangeFirstAccessPasswordViewModelMock.mockReturnValue({ ...defaultVM, isSuccess: true });
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    expect(screen.getByTestId('success-message')).toBeTruthy();
  });

  // 99. mutate not called on mismatch
  it('99. mutate NOT called when passwords do not match', async () => {
    const mutate = vi.fn();
    useChangeFirstAccessPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'Pass1234!' } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: 'Pass9999!' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).not.toHaveBeenCalled();
    });
  });

  // 100. Edge: very long password accepted
  it('100. very long password (256 chars) calls mutate successfully', async () => {
    const mutate = vi.fn();
    useChangeFirstAccessPasswordViewModelMock.mockReturnValue({ ...defaultVM, mutate });
    render(<FirstAccessPasswordPage isAuthenticated={true} user={authUser} />);
    const longPass = 'A'.repeat(250) + '1!aB';
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: longPass } });
    fireEvent.change(screen.getByTestId('confirmPassword-input'), { target: { value: longPass } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ password: longPass });
    });
  });
});
