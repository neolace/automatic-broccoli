# ADR 0003: Frontend Served via API Gateway + Lambda Instead of CloudFront

## Status

Accepted.

## Context

The architecture plan specifies CloudFront in front of a private S3 bucket
(Origin Access Control, a `ResponseHeadersPolicy`, SPA error-response
routing) as the static delivery path. The user directing this implementation
asked to remove CloudFront entirely, and, when the trade-offs below were
raised, chose to keep TLS and a custom domain on the frontend (rather than
drop to a public S3 website) by fronting the bucket with API Gateway instead.

Two constraints shaped the replacement:

1. **The bucket must stay fully private**, matching the existing invariant
   (Block Public Access, no direct public access) that `infra/test/frontend-stack.test.ts`
   already pinned down for the CloudFront version. API Gateway's HTTP API
   (v2) has no native, privately-signed integration with S3 — only Lambda or
   arbitrary HTTP proxy integrations — so keeping the bucket private while
   still using HTTP API requires a Lambda between API Gateway and S3, rather
   than a direct service integration.
2. **The response security headers must survive** (HSTS, CSP with
   `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Permissions-Policy`).
   API Gateway's static response-header mapping cannot embed a literal
   single quote, which CSP's own syntax requires (`'self'`,
   `'unsafe-inline'`), and S3 object metadata only passes through a small
   allow-list of headers (`Content-Type`, `Cache-Control`, …) — never
   `Content-Security-Policy` or `Strict-Transport-Security`. A pure
   API-Gateway-to-S3 proxy, with no compute in the path, cannot reproduce
   these headers at all.

Both constraints point the same way: a small Lambda has to sit in the
request path.

## Decision

[`infra/lib/frontend-stack.ts`](../../infra/lib/frontend-stack.ts) now serves
the frontend as:

```text
API Gateway HTTP API --(Lambda proxy integration)--> Site Lambda --(SDK, IAM)--> private S3 bucket
```

[`infra/lib/site-handler/index.ts`](../../infra/lib/site-handler/index.ts) is
a small Node.js Lambda (bundled with `aws-cdk-lib/aws-lambda-nodejs`) that:

- Resolves the S3 key from the request path: extension-less paths
  (client-side routes such as `/dashboard`) always resolve to `index.html`,
  so they survive a browser refresh; a path with a file extension maps 1:1
  to the matching object, and a genuine miss is a real 404 rather than a
  silently masked one.
- Attaches the same security headers CloudFront's `ResponseHeadersPolicy`
  used to, as plain object literals in the handler (no string-escaping
  limitation, unlike API Gateway's static header mapping).
- Sets long-lived immutable `Cache-Control` on hashed asset paths and
  `no-cache` on `index.html`, matching the caching intent
  `apps/web/vite.config.ts` already documented for CloudFront.

A custom domain, when `environments.ts` configures one for an environment,
is now a **regional** ACM certificate (in the stack's own deploy region) plus
an API Gateway v2 `DomainName`, replacing CloudFront's requirement that the
certificate exist in `us-east-1` regardless of where everything else is
deployed.

## Consequences

- **No CDN or edge cache.** Every request is served live by the Lambda —
  there is no edge caching, no CloudFront invalidation step in CI, and no
  points-of-presence distribution. This was a deliberate trade of
  performance/global latency for a simpler, single-region architecture, made
  explicitly by the user directing this work. Revisit if global latency or
  origin load becomes a measured problem.
- **A Lambda back in the frontend's request path.** Every static asset
  request now invokes a Lambda instead of being served directly by a CDN
  edge location. Cold starts and Lambda concurrency limits now apply to
  static asset delivery, which they did not before. The function is small
  and dependency-light (`@aws-sdk/client-s3` only) to keep this cost low.
- **Cache invalidation is gone as a deploy step**, since there is no cache to
  invalidate — `aws s3 sync ... --delete` in
  [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) is
  now sufficient on its own.
- **SPA fallback is now a path-shape heuristic** (has a file extension, or
  not) implemented in the Lambda, rather than CloudFront's status-code-based
  `CustomErrorResponses` (403/404 → `/index.html`). This means any future
  public asset path without a file extension would incorrectly receive
  `index.html`; the current build (`apps/web/dist`: `index.html`, `assets/`,
  `favicon.svg`) does not have this shape, but a new build convention should
  check this assumption still holds — see
  [`infra/test/site-handler.test.ts`](../../infra/test/site-handler.test.ts).
- **No change to the trust boundary.** The bucket is exactly as private as
  it was under CloudFront's Origin Access Control — only now IAM (the site
  Lambda's execution role, via `bucket.grantRead`) enforces that instead of
  OAC. See [`security.md`](../security.md).

## Alternatives considered

- **Public S3 static website hosting**, dropping TLS/custom-domain support
  entirely. Rejected — the user chose to keep a custom domain and TLS on the
  frontend rather than accept this regression.
- **HTTP API with a public bucket policy gated by a secret header** (the
  common "poor man's CDN" pattern for HTTP-proxy integrations that can't sign
  requests). Rejected — it weakens the bucket's privacy guarantee versus the
  CloudFront OAC model the tests already pin down, for no benefit once a
  Lambda was going to be needed for the security headers anyway.
- **REST API (v1) AWS-service integration directly to S3**, signed with
  IAM/SigV4 and no Lambda. Keeps the bucket fully private without any
  compute, but cannot emit the CSP/HSTS/`X-Frame-Options`/`Permissions-Policy`
  headers (see Context above) and cannot do path-shape-based SPA fallback
  without body-mapping-template logic that AWS integrations don't support for
  path parameters. Rejected once the header requirement was confirmed
  non-negotiable.
