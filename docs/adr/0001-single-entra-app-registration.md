# ADR 0001: Single Microsoft Entra Tenant and App Registration

## Status

Accepted (initial implementation). Revisit when any trigger below occurs.

## Context

The React SPA needs to authenticate users and call a protected API. Microsoft
normally recommends registering the user-facing client and the protected API
resource as two separate Entra app registrations, because separation
improves isolation and least privilege — a compromise of the client
registration's configuration does not automatically compromise the API
resource's configuration, and the two can evolve independent consent,
permission, and ownership models.

## Decision

Use **one Microsoft Entra tenant and one tightly coupled Entra application
registration** for both the SPA client and the API resource. The same
`CLIENT_ID` is therefore both the SPA's client id and the API's expected
`aud` claim — see [`entra-configuration.md`](../entra-configuration.md).

## Reason

This is a stated project constraint for the initial implementation: one
product, one browser client, one API authorization model, one team owning
both. A single registration keeps initial identity configuration small and
avoids maintaining redirect URIs, scopes, and consent in two places for what
is currently one product.

## Trade-off

This creates stronger coupling between the browser identity configuration
and the API resource configuration than the generally-recommended
two-registration model. A change intended only for the SPA side (e.g. adding
a redirect URI) and a change intended only for the API side (e.g. adding a
scope) both land in the same registration, and its blast radius is
correspondingly larger than it would be with two registrations.

## Guardrails

- Single-tenant only (`Accounts in this organizational directory only`).
- Authorization Code Flow with PKCE; no client secret is ever added to this registration for the SPA.
- The `access_as_user` scope is required on every protected API route (enforced in `infra/lib/api-stack.ts`, asserted in `infra/test/api-stack.test.ts`).
- API Gateway validates issuer, audience and scope before Lambda runs (see [`security.md`](../security.md)).
- Business authorization uses only stable claims (`oid`, `tid`, `scp`, `roles`) — never email, UPN, or display name (see [`authorization.md`](../authorization.md)).
- Named application owners review redirect URIs, the exposed scope, and assigned users/groups periodically.

## Mandatory revisit triggers

Split into separate SPA and API registrations if any of the following
becomes true:

- Another application (mobile, desktop, daemon, or a partner) needs to consume the API.
- Machine-to-machine (client-credentials) access is required.
- The API's Microsoft Graph or enterprise permissions become materially more privileged than what the SPA itself needs.
- The API is or will be owned/operated by a different team or on a different release lifecycle than the SPA.
- Security review or audit requires an independent compromise boundary between the client and the API resource.
