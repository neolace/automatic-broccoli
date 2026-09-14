import { InteractionStatus, type AccountInfo } from '@azure/msal-browser';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { useCallback, useContext } from 'react';

import { loginRequest, logoutRequest } from './auth-config';
import { AuthContext, type AuthFailure } from './auth-provider';
import type { TokenService } from './token-service';

export type AuthStatus =
  'initializing' | 'unauthenticated' | 'redirecting' | 'authenticated' | 'failed';

export interface AuthState {
  readonly status: AuthStatus;
  readonly account: AccountInfo | null;
  readonly failure: AuthFailure | null;
  readonly tokenService: TokenService;
  readonly signIn: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly clearFailure: () => void;
}

export function deriveStatus(
  inProgress: InteractionStatus,
  isAuthenticated: boolean,
  failure: AuthFailure | null,
): AuthStatus {
  switch (inProgress) {
    case InteractionStatus.Startup:
    case InteractionStatus.HandleRedirect:
      return 'initializing';
    case InteractionStatus.Logout:
    case InteractionStatus.AcquireToken:
      // loginRedirect() and acquireTokenSilent/Redirect all report as
      // AcquireToken in this MSAL version -- there is no separate Login status.
      return 'redirecting';
    case InteractionStatus.None:
    default:
      if (isAuthenticated) return 'authenticated';
      return failure ? 'failed' : 'unauthenticated';
  }
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within <AuthProvider>.');
  }

  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { failure, clearFailure, tokenService } = context;

  const signIn = useCallback(async () => {
    clearFailure();
    await instance.loginRedirect(loginRequest);
  }, [instance, clearFailure]);

  const signOut = useCallback(async () => {
    const account = instance.getActiveAccount();
    await instance.logoutRedirect({ ...logoutRequest, account: account ?? undefined });
  }, [instance]);

  return {
    status: deriveStatus(inProgress, isAuthenticated, failure),
    account: instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null,
    failure,
    tokenService,
    signIn,
    signOut,
    clearFailure,
  };
}
