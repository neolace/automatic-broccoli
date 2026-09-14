import { describe, expect, it } from 'vitest';

import { EnvironmentError, loadEnvironment } from './environment';

const validEnv = {
  VITE_ENTRA_TENANT_ID: 'tenant-id',
  VITE_ENTRA_CLIENT_ID: 'client-id',
  VITE_ENTRA_API_SCOPE: 'api://client-id/access_as_user',
  VITE_API_BASE_URL: 'https://api.example.com/',
};

describe('loadEnvironment', () => {
  it('loads and normalises a valid configuration', () => {
    const env = loadEnvironment(validEnv);
    expect(env.entraTenantId).toBe('tenant-id');
    expect(env.apiBaseUrl).toBe('https://api.example.com');
    expect(env.redirectPath).toBe('/');
  });

  it('throws with the list of missing keys', () => {
    expect(() => loadEnvironment({})).toThrowError(EnvironmentError);
    try {
      loadEnvironment({ VITE_ENTRA_TENANT_ID: 'tenant-id' });
      throw new Error('expected loadEnvironment to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentError);
      expect((error as EnvironmentError).missing).toContain('VITE_ENTRA_CLIENT_ID');
    }
  });

  it('rejects a non-absolute API base URL', () => {
    expect(() => loadEnvironment({ ...validEnv, VITE_API_BASE_URL: '/relative' })).toThrowError(
      EnvironmentError,
    );
  });

  it('rejects an API scope that is not an api:// URI', () => {
    expect(() =>
      loadEnvironment({ ...validEnv, VITE_ENTRA_API_SCOPE: 'access_as_user' }),
    ).toThrowError(EnvironmentError);
  });

  it('normalises a redirect path without a leading slash', () => {
    const env = loadEnvironment({ ...validEnv, VITE_ENTRA_REDIRECT_PATH: 'auth/callback' });
    expect(env.redirectPath).toBe('/auth/callback');
  });
});
