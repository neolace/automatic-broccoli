import { InteractionRequiredAuthError, type IPublicClientApplication } from '@azure/msal-browser';
import { describe, expect, it, vi } from 'vitest';

import { createTokenService, TokenAcquisitionError } from './token-service';

function buildInstance(overrides: Partial<IPublicClientApplication> = {}) {
  return {
    getActiveAccount: vi.fn(),
    getAllAccounts: vi.fn().mockReturnValue([]),
    acquireTokenSilent: vi.fn(),
    acquireTokenRedirect: vi.fn(),
    ...overrides,
  } as unknown as IPublicClientApplication;
}

const account = {
  homeAccountId: 'abc',
  environment: 'x',
  tenantId: 't',
  username: 'u',
  localAccountId: 'l',
};

describe('createTokenService', () => {
  it('rejects when no account is signed in', async () => {
    const instance = buildInstance();
    const service = createTokenService(instance, { scopes: ['api://x/access_as_user'] });

    await expect(service.acquireApiToken()).rejects.toMatchObject({
      interactionRequired: true,
    });
  });

  it('returns the access token from a successful silent acquisition', async () => {
    const instance = buildInstance({
      getActiveAccount: vi.fn().mockReturnValue(account),
      acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: 'token-123' }),
    });
    const service = createTokenService(instance, { scopes: ['api://x/access_as_user'] });

    await expect(service.acquireApiToken()).resolves.toBe('token-123');
  });

  it('triggers interactive redirect and rejects when interaction is required', async () => {
    const onInteractionRequired = vi.fn().mockResolvedValue(undefined);
    const instance = buildInstance({
      getActiveAccount: vi.fn().mockReturnValue(account),
      acquireTokenSilent: vi
        .fn()
        .mockRejectedValue(
          new InteractionRequiredAuthError('interaction_required', 'test-correlation-id'),
        ),
    });
    const service = createTokenService(instance, {
      scopes: ['api://x/access_as_user'],
      onInteractionRequired,
    });

    await expect(service.acquireApiToken()).rejects.toBeInstanceOf(TokenAcquisitionError);
    expect(onInteractionRequired).toHaveBeenCalledWith(account);
  });

  it('wraps unexpected errors', async () => {
    const instance = buildInstance({
      getActiveAccount: vi.fn().mockReturnValue(account),
      acquireTokenSilent: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const service = createTokenService(instance, { scopes: ['api://x/access_as_user'] });

    await expect(service.acquireApiToken()).rejects.toMatchObject({ interactionRequired: false });
  });
});
