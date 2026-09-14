/**
 * Frontend runtime configuration.
 *
 * Everything here is public: tenant and client IDs, the API scope and the API
 * base URL are identifiers, not secrets. The build fails fast when a required
 * value is missing rather than silently falling back to an unsafe default.
 */

export interface Environment {
  readonly entraTenantId: string;
  readonly entraClientId: string;
  readonly entraApiScope: string;
  readonly apiBaseUrl: string;
  /** Path appended to the origin to form the MSAL redirect URI. Defaults to "/". */
  readonly redirectPath: string;
  readonly mode: string;
}

export class EnvironmentError extends Error {
  constructor(readonly missing: readonly string[]) {
    super(
      `Missing required frontend configuration: ${missing.join(', ')}. ` +
        'See apps/web/.env.example and docs/entra-configuration.md.',
    );
    this.name = 'EnvironmentError';
  }
}

const REQUIRED_KEYS = [
  'VITE_ENTRA_TENANT_ID',
  'VITE_ENTRA_CLIENT_ID',
  'VITE_ENTRA_API_SCOPE',
  'VITE_API_BASE_URL',
] as const;

type RawEnvironment = Partial<Record<(typeof REQUIRED_KEYS)[number], string>> & {
  VITE_ENTRA_REDIRECT_PATH?: string;
  MODE?: string;
};

function required(source: RawEnvironment, key: (typeof REQUIRED_KEYS)[number]): string {
  return (source[key] ?? '').trim();
}

export function loadEnvironment(source: RawEnvironment): Environment {
  const missing = REQUIRED_KEYS.filter((key) => required(source, key) === '');
  if (missing.length > 0) {
    throw new EnvironmentError(missing);
  }

  const apiBaseUrl = required(source, 'VITE_API_BASE_URL').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(apiBaseUrl)) {
    throw new EnvironmentError(['VITE_API_BASE_URL (must be an absolute http(s) URL)']);
  }

  const entraApiScope = required(source, 'VITE_ENTRA_API_SCOPE');
  if (!entraApiScope.startsWith('api://')) {
    throw new EnvironmentError(['VITE_ENTRA_API_SCOPE (expected api://<CLIENT_ID>/<scope>)']);
  }

  const redirectPath = (source.VITE_ENTRA_REDIRECT_PATH ?? '/').trim() || '/';

  return {
    entraTenantId: required(source, 'VITE_ENTRA_TENANT_ID'),
    entraClientId: required(source, 'VITE_ENTRA_CLIENT_ID'),
    entraApiScope,
    apiBaseUrl,
    redirectPath: redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`,
    mode: source.MODE ?? 'production',
  };
}

export const environment: Environment = loadEnvironment(import.meta.env);
