import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

import {
  loadEntraConfig,
  loadEnvironmentConfig,
  resolveApiOrigin,
  resolveCorsOrigins,
  type EnvironmentConfig,
} from '../lib/config/environments';

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

describe('resolveCorsOrigins', () => {
  it('adds the site domain origin when DomainConfig is present', () => {
    const env: EnvironmentConfig = {
      name: 'prod',
      region: 'us-east-1',
      corsOrigins: ['https://app.example.com'],
      logRetention: RetentionDays.SIX_MONTHS,
      isProduction: true,
      domain: {
        hostedZoneName: 'example.com',
        siteDomainName: 'app.example.com',
        apiDomainName: 'api.example.com',
      },
    };

    expect(resolveCorsOrigins(env)).toEqual(['https://app.example.com']);
  });

  it('merges an extra local origin with the configured site domain', () => {
    const env: EnvironmentConfig = {
      name: 'test',
      region: 'us-east-1',
      corsOrigins: ['http://localhost:5173'],
      logRetention: RetentionDays.ONE_MONTH,
      isProduction: false,
      domain: {
        hostedZoneName: 'example.com',
        siteDomainName: 'test.app.example.com',
        apiDomainName: 'test.api.example.com',
      },
    };

    expect(resolveCorsOrigins(env)).toEqual([
      'http://localhost:5173',
      'https://test.app.example.com',
    ]);
  });
});

describe('resolveApiOrigin', () => {
  it('prefers the custom API domain when DomainConfig is set', () => {
    const env: EnvironmentConfig = {
      name: 'prod',
      region: 'us-east-1',
      corsOrigins: ['https://app.example.com'],
      logRetention: RetentionDays.SIX_MONTHS,
      isProduction: true,
      domain: {
        hostedZoneName: 'example.com',
        siteDomainName: 'app.example.com',
        apiDomainName: 'api.example.com',
      },
    };

    expect(resolveApiOrigin(env, 'https://abc.execute-api.us-east-1.amazonaws.com')).toBe(
      'https://api.example.com',
    );
  });

  it('falls back to the execute-api URL without a trailing slash', () => {
    const env = loadEnvironmentConfig('dev');
    expect(resolveApiOrigin(env, 'https://abc.execute-api.us-east-1.amazonaws.com/')).toBe(
      'https://abc.execute-api.us-east-1.amazonaws.com',
    );
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
