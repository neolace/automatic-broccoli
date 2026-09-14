import {
  InteractionRequiredAuthError,
  type AccountInfo,
  type IPublicClientApplication,
} from '@azure/msal-browser';

/**
 * Obtains Entra access tokens for the API without exposing MSAL internals to
 * the rest of the application. The API client is the only intended consumer.
 */
export interface TokenService {
  /** Resolves with a bearer access token for the API scope. */
  acquireApiToken(): Promise<string>;
}

export class TokenAcquisitionError extends Error {
  constructor(
    message: string,
    readonly interactionRequired: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'TokenAcquisitionError';
  }
}

export interface TokenServiceOptions {
  scopes: readonly string[];
  /**
   * When interaction is required this is called to start the redirect flow.
   * Defaults to `instance.acquireTokenRedirect`. Injected so tests can observe it.
   */
  onInteractionRequired?: (account: AccountInfo) => Promise<void>;
}

function resolveAccount(instance: IPublicClientApplication): AccountInfo | null {
  return instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;
}

export function createTokenService(
  instance: IPublicClientApplication,
  options: TokenServiceOptions,
): TokenService {
  const scopes = [...options.scopes];
  const onInteractionRequired =
    options.onInteractionRequired ??
    ((account: AccountInfo) => instance.acquireTokenRedirect({ scopes, account }));

  return {
    async acquireApiToken() {
      const account = resolveAccount(instance);
      if (!account) {
        throw new TokenAcquisitionError('No signed-in account is available.', true);
      }

      try {
        const result = await instance.acquireTokenSilent({ scopes, account });
        if (!result.accessToken) {
          throw new TokenAcquisitionError('Entra returned an empty access token.', false);
        }
        return result.accessToken;
      } catch (error) {
        if (error instanceof TokenAcquisitionError) throw error;

        if (error instanceof InteractionRequiredAuthError) {
          // Consent, MFA, Conditional Access or re-authentication is required.
          // The redirect navigates away; the rejection below only matters if it does not.
          await onInteractionRequired(account);
          throw new TokenAcquisitionError('User interaction is required to continue.', true, {
            cause: error,
          });
        }

        throw new TokenAcquisitionError('Unable to acquire an API access token.', false, {
          cause: error,
        });
      }
    },
  };
}
