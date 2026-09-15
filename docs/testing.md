# Testing

## Description

Tests are layered so each class of defect is caught at the cheapest level
that can catch it: unit tests for isolated logic, component tests for React
behavior, CDK assertions for infrastructure intent, and end-to-end tests for
the deployed authentication and API path. Security-relevant negative paths
(missing scope, wrong tenant, unauthenticated call, forbidden ownership) are
treated as first-class test cases, not an afterthought.

## Running everything

```bash
npm run validate   # format:check, lint, typecheck, test (JS/TS + C#), build (JS/TS + C#)
npm test           # vitest (packages/shared, apps/web, infra) + dotnet test (apps/api)
npm run e2e        # Playwright, from apps/web
```

Or per stack:

```bash
npx vitest run --project shared
npx vitest run --project web
npx vitest run --project infra
dotnet test apps/api/App.Api.sln
```

## Frontend (`apps/web`, Vitest + React Testing Library)

Covers the browser application's state machine, not Microsoft's identity
platform: initialization, silent token acquisition and its failure modes,
protected-route redirects (no loop on refresh — see `protected-route.test.tsx`),
the login page's single sign-in action with no password field, API error
classification (401/403/429/5xx/network/timeout in `api-client.test.ts`),
and — explicitly — that a bearer token never appears in a thrown error's
serialized form. MSAL is mocked at this layer; JWT cryptography is Entra's
and API Gateway's responsibility, not something this suite re-tests (see
[security.md](security.md)).

## API (`apps/api`, xUnit)

28 tests across claims extraction, authorization rules, business validation
in `ApplicationService`, and each handler's HTTP-level behavior using
`Amazon.Lambda.TestUtilities.TestLambdaContext` — no real AWS resources.
Domain services (`ApplicationService`) are tested independently of the AWS
event types, per [lambda.md](lambda.md#testing). Negative paths explicitly
covered: missing authorizer claims, missing `oid`/`tid`, missing scope,
missing role, wrong resource owner, invalid request body, unsupported HTTP
method.

## Infrastructure (`infra`, Vitest + `aws-cdk-lib/assertions`)

Asserts security-critical properties, not just "the resource exists":

- JWT authorizer issuer and audience match the configured Entra tenant/client.
- `access_as_user` is required on every protected route; `/health` has no authorizer.
- CORS never resolves to `*`.
- Every Lambda role has only `AWSLambdaBasicExecutionRole` — no custom or wildcard policy.
- Every log group has retention configured.
- Every documented alarm exists.
- The S3 bucket blocks all public access, is versioned and encrypted.
- The site Lambda has read-only access to the site bucket and nothing else.
- Every route on the frontend's HTTP API is a Lambda proxy integration.

A separate suite, `infra/test/site-handler.test.ts`, unit-tests the site
Lambda directly (mocking `@aws-sdk/client-s3`): extension-less paths resolve
to `index.html`, a path with a file extension maps to the matching object,
a genuine miss on an asset path is a real 404 rather than a masked one, and
every response carries HSTS, `frame-ancestors 'none'`, and the other
required security headers.

These tests instantiate real CDK stacks, so `npm run test --workspace infra`
runs an actual `dotnet publish` of the API Lambda project (see
[infrastructure.md](infrastructure.md#packaging-the-c-lambda)) and an esbuild
bundle of the site Lambda — expect a few extra seconds compared with a
pure-TypeScript CDK app with no bundled assets.

## End-to-end (`apps/web/e2e`, Playwright)

Split into two projects because interactive Entra sign-in (with MFA and
Conditional Access) must never be automated or weakened just to make UI
testing easier:

- **`smoke`** — runs against a local preview build with no Entra dependency:
  an unauthenticated visitor is redirected to `/login`, sees the Microsoft
  sign-in action and no password field, and reloading `/login` does not loop.
  Runs in CI on every change.
- **`authenticated`** — requires a Playwright storage state captured ahead of
  time from a controlled test identity (`E2E_STORAGE_STATE`) and a deployed
  API (`E2E_BASE_URL`). Skipped automatically when those are not set. Capture
  a storage state once, outside CI, with:

  ```bash
  npm run e2e:auth-setup --workspace apps/web
  ```

  and store the resulting file as a CI secret/artifact rather than
  regenerating it on every run.

## What is intentionally not unit-tested here

Per the plan: Microsoft's JWT signature verification, JWKS retrieval, and
OIDC discovery. These are Entra's and API Gateway's responsibilities; this
repository verifies its own configuration of them (issuer, audience, scope —
see the infra assertions above), not their internal correctness.
