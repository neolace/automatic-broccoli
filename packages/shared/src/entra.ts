/**
 * Identity constants shared by the SPA, the API and the infrastructure.
 *
 * These are identifiers, not secrets. They describe the single Entra app
 * registration model documented in docs/entra-configuration.md.
 */

/** Delegated scope exposed by the API resource on the single app registration. */
export const API_SCOPE_NAME = 'access_as_user';

/** Builds the Application ID URI for the registration (`api://<CLIENT_ID>`). */
export function applicationIdUri(clientId: string): string {
  return `api://${clientId}`;
}

/** Builds the full delegated scope requested by MSAL (`api://<CLIENT_ID>/access_as_user`). */
export function apiScope(clientId: string): string {
  return `${applicationIdUri(clientId)}/${API_SCOPE_NAME}`;
}

/** v2.0 issuer for a single tenant; API Gateway validates `iss` against this value. */
export function entraIssuer(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/v2.0`;
}

/** Tenant-specific authority used by MSAL in the browser. */
export function entraAuthority(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}`;
}
