import { describe, expect, it } from 'vitest';

import {
  apiScope,
  applicationIdUri,
  entraAuthority,
  entraIssuer,
  isValidCorrelationId,
} from './index';

describe('entra helpers', () => {
  it('builds the application id uri and scope from the client id', () => {
    expect(applicationIdUri('abc')).toBe('api://abc');
    expect(apiScope('abc')).toBe('api://abc/access_as_user');
  });

  it('builds tenant-specific issuer and authority', () => {
    expect(entraIssuer('tenant')).toBe('https://login.microsoftonline.com/tenant/v2.0');
    expect(entraAuthority('tenant')).toBe('https://login.microsoftonline.com/tenant');
  });
});

describe('isValidCorrelationId', () => {
  it('accepts uuids and short safe tokens', () => {
    expect(isValidCorrelationId('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true);
    expect(isValidCorrelationId('req_12345678')).toBe(true);
  });

  it('rejects values that could be used for log injection', () => {
    expect(isValidCorrelationId('short')).toBe(false);
    expect(isValidCorrelationId('has spaces here')).toBe(false);
    expect(isValidCorrelationId('new\nline-0000000')).toBe(false);
    expect(isValidCorrelationId('x'.repeat(129))).toBe(false);
    expect(isValidCorrelationId(42)).toBe(false);
  });
});
