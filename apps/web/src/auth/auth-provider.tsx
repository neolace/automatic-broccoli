import {
  EventType,
  PublicClientApplication,
  type AuthenticationResult,
  type Configuration,
  type EventMessage,
  type IPublicClientApplication,
} from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { apiTokenRequest } from './auth-config';
import { createTokenService, type TokenService } from './token-service';

/**
 * Creates and initialises the MSAL instance. Called once at bootstrap so the
 * rest of the tree never sees an uninitialised client.
 */
export async function createMsalInstance(config: Configuration): Promise<IPublicClientApplication> {
  const instance = new PublicClientApplication(config);
  await instance.initialize();

  if (!instance.getActiveAccount() && instance.getAllAccounts().length > 0) {
    instance.setActiveAccount(instance.getAllAccounts()[0] ?? null);
  }

  return instance;
}

export interface AuthFailure {
  readonly message: string;
  readonly errorCode?: string;
}

export interface AuthContextValue {
  readonly instance: IPublicClientApplication;
  readonly tokenService: TokenService;
  readonly failure: AuthFailure | null;
  readonly clearFailure: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  instance: IPublicClientApplication;
  children: ReactNode;
}

function isAuthResult(payload: EventMessage['payload']): payload is AuthenticationResult {
  return !!payload && typeof payload === 'object' && 'account' in payload;
}

export function AuthProvider({ instance, children }: AuthProviderProps) {
  const [failure, setFailure] = useState<AuthFailure | null>(null);

  useEffect(() => {
    const callbackId = instance.addEventCallback((event: EventMessage) => {
      switch (event.eventType) {
        case EventType.LOGIN_SUCCESS:
        case EventType.ACQUIRE_TOKEN_SUCCESS:
          if (isAuthResult(event.payload) && event.payload.account) {
            instance.setActiveAccount(event.payload.account);
          }
          setFailure(null);
          break;
        // loginRedirect() is itself implemented on top of the acquireToken
        // machinery in this MSAL version, so both a failed sign-in and a
        // failed silent/interactive token acquisition surface here.
        case EventType.ACQUIRE_TOKEN_FAILURE: {
          const error = event.error;
          setFailure({
            message: error?.message ?? 'Authentication failed.',
            errorCode:
              error && 'errorCode' in error
                ? String((error as { errorCode: unknown }).errorCode)
                : undefined,
          });
          break;
        }
        default:
          break;
      }
    });

    return () => {
      if (callbackId) instance.removeEventCallback(callbackId);
    };
  }, [instance]);

  const value = useMemo<AuthContextValue>(
    () => ({
      instance,
      tokenService: createTokenService(instance, { scopes: apiTokenRequest.scopes }),
      failure,
      clearFailure: () => setFailure(null),
    }),
    [instance, failure],
  );

  return (
    <MsalProvider instance={instance}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </MsalProvider>
  );
}
