# Entra Configuration

## Description

This is the authoritative identity configuration. It is created once, by
hand, in the Microsoft Entra admin center — the CDK app does not create or
mutate the Entra app registration; it only consumes two non-secret
identifiers from it (see [Wiring the identifiers to the app](#wiring-the-identifiers-to-the-app)).

The architecture deliberately uses **one Entra tenant and one Entra app
registration** for both the React SPA and the API resource it calls. This is
a documented trade-off — see
[`adr/0001-single-entra-app-registration.md`](adr/0001-single-entra-app-registration.md)
for when to revisit it.

## Create the registration

In the Entra admin center → App registrations → New registration:

```text
Application name:            my-application
Supported account type:      Accounts in this organizational directory only
Application type:            Single-page application
```

Record the two values shown on the registration's Overview page:

```text
TENANT_ID   (Directory (tenant) ID)
CLIENT_ID   (Application (client) ID)
```

No client secret is created or required — the SPA is a public client using
Authorization Code Flow with PKCE (see [authentication.md](authentication.md)).

## Redirect URIs

Register only the exact URIs the application uses; do not add speculative or
wildcard entries.

```text
Development (local Vite dev server):
  http://localhost:5173

Production (final HTTPS application domain):
  https://app.example.com
```

Localhost HTTP is acceptable for local development only; every non-local
redirect URI must use HTTPS.

## Expose the API

Under **Expose an API**, set the Application ID URI to the default pattern
and add one delegated scope:

```text
Application ID URI:  api://<CLIENT_ID>
Delegated scope:     access_as_user
```

MSAL requests the full scope `api://<CLIENT_ID>/access_as_user` — see
[`packages/shared/src/entra.ts`](../packages/shared/src/entra.ts) for the
helper that builds this string consistently on the frontend and in
`infra/lib/api-stack.ts`.

Ensure the registration issues **v2 access tokens** (Manifest →
`accessTokenAcceptedVersion: 2`). For a v2 token, expect:

```text
aud = <CLIENT_ID>      (same value as the SPA's client ID -- single registration)
iss = https://login.microsoftonline.com/<TENANT_ID>/v2.0
tid = <TENANT_ID>
oid = <USER_OBJECT_ID>
scp = access_as_user
```

`infra/lib/api-stack.ts` configures the API Gateway JWT authorizer with
exactly this issuer and audience — see [api.md](api.md).

## Security controls

Enable organizational controls in Entra directly; do not recreate them in
React or Lambda (see [security.md](security.md)):

```text
MFA
Conditional Access
Sign-in risk policies
Device compliance where required
Session controls
Group/user assignment
```

## Wiring the identifiers to the app

The tenant ID and client ID are non-secret identifiers, not credentials, so
they are supplied plainly:

- **Frontend** (`apps/web/.env.example`): `VITE_ENTRA_TENANT_ID`, `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_API_SCOPE`.
- **Infrastructure** (deploy-time environment variables, read by [`infra/lib/config/environments.ts`](../infra/lib/config/environments.ts)): `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`.

Both must reference the same registration. `npm run synth` / `npm run
deploy` fail fast with a clear error if `ENTRA_TENANT_ID` or
`ENTRA_CLIENT_ID` is missing — see [deployment.md](deployment.md).

## Ownership and hygiene

Assign a small number of named application owners and periodically review:

- redirect URIs (remove stale ones),
- the exposed scope and any consent grants,
- assigned users/groups,
- whether the single-registration trade-off (ADR 0001) still holds.
