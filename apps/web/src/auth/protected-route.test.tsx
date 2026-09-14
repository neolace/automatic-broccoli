import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';

import { AuthContext, type AuthContextValue } from './auth-provider';
import { ProtectedRoute } from './protected-route';

let mockInProgress = 'none';
let mockIsAuthenticated = false;

vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: { getActiveAccount: () => null, getAllAccounts: () => [] },
    inProgress: mockInProgress,
  }),
  useIsAuthenticated: () => mockIsAuthenticated,
}));

function renderProtected(initialEntry = '/dashboard') {
  const value: AuthContextValue = {
    instance: {} as AuthContextValue['instance'],
    tokenService: { acquireApiToken: vi.fn() },
    failure: null,
    clearFailure: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/error" element={<p>error page</p>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <p>protected content</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('shows a loading state during startup instead of protected content', () => {
    mockInProgress = 'startup';
    mockIsAuthenticated = false;

    renderProtected();

    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    mockInProgress = 'none';
    mockIsAuthenticated = false;

    renderProtected();

    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('renders protected content once authenticated', () => {
    mockInProgress = 'none';
    mockIsAuthenticated = true;

    renderProtected();

    expect(screen.getByText('protected content')).toBeInTheDocument();
  });
});
