import {
  LogLevel,
  type Configuration,
  type EndSessionRequest,
  type RedirectRequest,
  type SilentRequest,
} from '@azure/msal-browser';
import { entraAuthority } from '@app/shared';

import { environment } from '../config/environment';

/**
 * Static MSAL configuration for the single Entra app registration.
 *
 * - Tenant-specific authority: this is a single-tenant workload, so the SPA and
 *   the API Gateway authorizer share the same tenant boundary.
 * - sessionStorage cache: tokens live for the browser tab/session only. Changing
 *   this is a security trade-off that must be recorded in docs/security.md.
 * - No client secret: the SPA is a public client using PKCE.
 */
export function buildMsalConfig(origin: string): Configuration {
  const redirectUri = `${origin}${environment.redirectPath === '/' ? '' : environment.redirectPath}`;

  return {
    auth: {
      clientId: environment.entraClientId,
      authority: entraAuthority(environment.entraTenantId),
      redirectUri,
      postLogoutRedirectUri: origin,
    },
    cache: {
      cacheLocation: 'sessionStorage',
    },
    system: {
      loggerOptions: {
        logLevel: environment.mode === 'development' ? LogLevel.Info : LogLevel.Warning,
        piiLoggingEnabled: false,
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          if (level === LogLevel.Error) console.error(message);
          else if (level === LogLevel.Warning) console.warn(message);
        },
      },
    },
  };
}

/** Scopes requested at sign-in so consent is granted once for the API scope. */
export const loginRequest: RedirectRequest = {
  scopes: [environment.entraApiScope],
};

/** Silent request used before every API call. */
export const apiTokenRequest: SilentRequest = {
  scopes: [environment.entraApiScope],
};

export const logoutRequest: EndSessionRequest = {};
