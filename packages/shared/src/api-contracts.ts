/**
 * HTTP contract between the SPA and the Lambda API.
 *
 * Keep these types small and explicit: they are the only coupling between the
 * two applications and are versioned with the code.
 */

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

/**
 * Allow-listed identity projection returned by `GET /api/me`.
 *
 * Only stable identifiers and presentation data are returned. The raw token and
 * the full claim set are never echoed back to the browser.
 */
export interface MeResponse {
  /** Stable user object identifier (`oid`). Use this for authorization. */
  userId: string;
  /** Tenant identifier (`tid`). */
  tenantId: string;
  /** Delegated scopes granted to the calling application (`scp`). */
  scopes: string[];
  /** Application roles assigned to the user (`roles`), if any. */
  roles: string[];
  /** Presentation only. Never use for authorization. */
  displayName?: string;
}

export interface ApplicationRecord {
  id: string;
  name: string;
  description?: string;
  /** `oid` of the user who owns the record. */
  ownerId: string;
  createdAt: string;
}

export interface CreateApplicationRequest {
  name: string;
  description?: string;
}

export interface ListApplicationsResponse {
  items: ApplicationRecord[];
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Echoed so a user can quote it to support without exposing internals. */
    correlationId: string;
    /** Field-level validation details, when applicable. */
    details?: Record<string, string>;
  };
}
