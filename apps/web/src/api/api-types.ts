export type {
  ApiErrorBody,
  ApiErrorCode,
  ApplicationRecord,
  CreateApplicationRequest,
  HealthResponse,
  ListApplicationsResponse,
  MeResponse,
} from '@app/shared';

export type ApiErrorKind =
  'unauthenticated' | 'forbidden' | 'throttled' | 'client' | 'server' | 'network' | 'timeout';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number | null,
    readonly correlationId: string,
    readonly code?: string,
    readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
