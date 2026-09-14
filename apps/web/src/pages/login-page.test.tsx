import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../auth/auth-provider';
import { LoginPage } from './login-page';

const mockInstance = {
  loginRedirect: vi.fn().mockResolvedValue(undefined),
  getActiveAccount: vi.fn().mockReturnValue(null),
  getAllAccounts: vi.fn().mockReturnValue([]),
};

vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: mockInstance, inProgress: 'none' }),
  useIsAuthenticated: () => false,
}));

function renderWithAuth(overrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    instance: mockInstance as unknown as AuthContextValue['instance'],
    tokenService: { acquireApiToken: vi.fn() },
    failure: null,
    clearFailure: vi.fn(),
    ...overrides,
  };

  return render(
    <AuthContext.Provider value={value}>
      <LoginPage />
    </AuthContext.Provider>,
  );
}

describe('LoginPage', () => {
  it('renders a single Microsoft sign-in action and no password field', () => {
    renderWithAuth();

    expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it('shows a friendly error and a retry action on failure', async () => {
    renderWithAuth({ failure: { message: 'Consent required' } });

    expect(screen.getByRole('alert')).toHaveTextContent('Consent required');
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(mockInstance.loginRedirect).toHaveBeenCalled();
  });
});
