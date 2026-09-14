import { CORRELATION_ID_HEADER } from '@app/shared';

import type { TokenService } from '../auth/token-service';
import { ApiError, type ApiErrorBody, type ApiErrorKind } from './api-types';

/**
 * Single browser-side gateway to the backend API.
 *
 * Hides token acquisition, headers, correlation IDs, JSON handling, timeouts
 * and retry policy from feature components. The bearer token is attached here
 * and is never logged.
 */
export interface ApiClientOptions {
  baseUrl: string;
  tokenService: TokenService;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  generateCorrelationId?: () => string;
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function defaultCorrelationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function classifyStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'throttled';
  if (status >= 500) return 'server';
  return 'client';
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const {
    baseUrl,
    tokenService,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
    generateCorrelationId = defaultCorrelationId,
  } = options;

  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const correlationId = generateCorrelationId();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let token: string;
    try {
      token = await tokenService.acquireApiToken();
    } catch {
      clearTimeout(timeout);
      throw new ApiError(
        'unauthenticated',
        'Unable to acquire an access token for this request.',
        null,
        correlationId,
        undefined,
        undefined,
      );
    }

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          [CORRELATION_ID_HEADER]: correlationId,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      const kind: ApiErrorKind = controller.signal.aborted ? 'timeout' : 'network';
      throw new ApiError(
        kind,
        kind === 'timeout' ? 'The request timed out.' : 'A network error occurred.',
        null,
        correlationId,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      let parsed: ApiErrorBody | undefined;
      try {
        parsed = (await response.json()) as ApiErrorBody;
      } catch {
        // Body was not JSON; fall through to a generic message below.
      }

      throw new ApiError(
        classifyStatus(response.status),
        parsed?.error.message ?? `Request failed with status ${response.status}.`,
        response.status,
        parsed?.error.correlationId ?? correlationId,
        parsed?.error.code,
        parsed?.error.details,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  };
}
