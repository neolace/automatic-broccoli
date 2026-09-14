import { describe, expect, it, vi } from 'vitest';

import type { TokenService } from '../auth/token-service';
import { createApiClient } from './api-client';
import { ApiError } from './api-types';

function tokenService(token = 'token-abc'): TokenService {
  return { acquireApiToken: vi.fn().mockResolvedValue(token) };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createApiClient', () => {
  it('attaches the bearer token and a correlation id header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      tokenService: tokenService(),
      fetchImpl,
      generateCorrelationId: () => 'corr-1',
    });

    await client.get('/api/me');

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-abc');
    expect(headers['x-correlation-id']).toBe('corr-1');
  });

  it('never includes the token in a thrown error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(403, {
        error: { code: 'FORBIDDEN', message: 'no access', correlationId: 'corr-2' },
      }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      tokenService: tokenService('super-secret-token'),
      fetchImpl,
    });

    const error = await client.get('/api/me').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('forbidden');
    expect(JSON.stringify(error)).not.toContain('super-secret-token');
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [429, 'throttled'],
    [500, 'server'],
    [400, 'client'],
  ] as const)('classifies HTTP %d as %s', async (status, kind) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(status, { error: { code: 'X', message: 'm', correlationId: 'c' } }),
      );
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      tokenService: tokenService(),
      fetchImpl,
    });

    const error = (await client.get('/x').catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe(kind);
  });

  it('reports a network error distinctly from a timeout', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('failed to fetch'));
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      tokenService: tokenService(),
      fetchImpl,
    });

    const error = (await client.get('/x').catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe('network');
  });

  it('surfaces an unauthenticated error when token acquisition fails', async () => {
    const fetchImpl = vi.fn();
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      tokenService: { acquireApiToken: vi.fn().mockRejectedValue(new Error('no session')) },
      fetchImpl,
    });

    const error = (await client.get('/x').catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe('unauthenticated');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
