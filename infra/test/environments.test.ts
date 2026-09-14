import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadEntraConfig, loadEnvironmentConfig } from '../lib/config/environments';

describe('loadEnvironmentConfig', () => {
  it('returns distinct CORS origins and log retention per environment', () => {
    const dev = loadEnvironmentConfig('dev');
    const prod = loadEnvironmentConfig('prod');

    expect(dev.corsOrigins).toEqual(['http://localhost:5173']);
    expect(dev.isProduction).toBe(false);
    expect(prod.isProduction).toBe(true);
    expect(prod.corsOrigins).not.toEqual(dev.corsOrigins);
  });
});

describe('loadEntraConfig', () => {
  const originalTenant = process.env.ENTRA_TENANT_ID;
  const originalClient = process.env.ENTRA_CLIENT_ID;

  beforeEach(() => {
    delete process.env.ENTRA_TENANT_ID;
    delete process.env.ENTRA_CLIENT_ID;
  });

  afterEach(() => {
    if (originalTenant) process.env.ENTRA_TENANT_ID = originalTenant;
    if (originalClient) process.env.ENTRA_CLIENT_ID = originalClient;
  });

  it('throws a clear error when the tenant or client id is missing', () => {
    expect(() => loadEntraConfig()).toThrowError(/ENTRA_TENANT_ID and ENTRA_CLIENT_ID/);
  });

  it('loads the tenant and client id from the environment', () => {
    process.env.ENTRA_TENANT_ID = 'tenant-1';
    process.env.ENTRA_CLIENT_ID = 'client-1';

    expect(loadEntraConfig()).toEqual({ tenantId: 'tenant-1', clientId: 'client-1' });
  });
});
