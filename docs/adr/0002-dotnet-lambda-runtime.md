# ADR 0002: Lambda API Implemented in C# on .NET 10

## Status

Accepted.

## Context

The architecture plan this repository implements states: "Use TypeScript for
consistency across frontend and infrastructure," and lists a TypeScript
Lambda project layout (`apps/api/src/{handlers,auth,services,repositories,
models,errors,utils}`). The user directing this implementation explicitly
requested the Lambda be written in C# on .NET 10 instead, overriding that
one line of the plan while leaving every other decision in the plan intact
(single Entra registration, API Gateway JWT authorizer, no re-implemented
token validation, CDK for infrastructure, the same test-pyramid shape, etc.).

## Decision

`apps/api` is a C# solution (`App.Api.sln`) targeting `net10.0`, deployed to
AWS Lambda's managed `dotnet10` runtime (`Runtime.DOTNET_10` in
`aws-cdk-lib`, confirmed available as of aws-cdk-lib 2.269.0). The internal
module layout mirrors the plan's intended TypeScript layout one-for-one —
`Handlers/`, `Auth/`, `Services/`, `Repositories/`, `Models/`, `Errors/`,
`Utils/` — so the architectural shape described in the plan
(thin handlers, no re-implemented JWT verification, claims-based
authorization, repository seam) is preserved regardless of language. See
[`lambda.md`](../lambda.md).

## Consequences

- **No shared compiler-enforced contract.** `apps/web` and `apps/api` no
  longer share `packages/shared`'s TypeScript types directly. The wire
  contract is duplicated by hand in
  `apps/api/src/App.Api/Models/ApiContracts.cs`, matching
  `packages/shared/src/api-contracts.ts` field-for-field (camelCase on the
  wire in both directions). A contract change must be applied to both files
  in the same commit — see [`api.md`](../api.md#cross-language-contract).
  `packages/shared` still serves `apps/web` and `infra` (Entra issuer/scope
  helpers, the correlation-id validation regex mirrored in
  `CorrelationId.cs`).
- **A second toolchain in CI/local dev.** Contributors need the .NET 10 SDK
  in addition to Node.js. `npm run validate`, `npm test`, `npm run build`
  and `npm run format`/`format:check` all transparently shell out to the
  matching `dotnet` command (`test:api`, `build:api`, `format:api`,
  `format:check:api` in the root `package.json`), so day-to-day commands are
  unchanged; only the prerequisite list grows (see
  [`deployment.md`](../deployment.md#prerequisites)).
- **A different Lambda packaging step.** CDK bundles the Lambda by running
  `dotnet publish` (locally when the SDK is present, otherwise via the
  official `public.ecr.aws/sam/build-dotnet10` image) instead of an esbuild
  bundle — see
  [`infra/lib/api-lambda-bundling.ts`](../../infra/lib/api-lambda-bundling.ts)
  and [`infrastructure.md`](../infrastructure.md#packaging-the-c-lambda).
  This adds a few seconds to `cdk synth`/infra tests compared with a
  TypeScript Lambda (see
  [`troubleshooting.md`](../troubleshooting.md#cdk-synth-bundles-the-lambda-every-time-and-its-slow)).
- **No change to the security or authorization model.** API Gateway still
  performs all cryptographic token validation; Lambda still only receives
  and shapes already-validated claims — the language of the handler does not
  change what it is trusted to do. See [`security.md`](../security.md).
- **No change to Well-Architected pillar scoring.** A managed .NET Lambda
  runtime is exactly as serverless, scoped, and observable as a managed
  Node.js one — see
  [`well-architected.md`](../well-architected.md#recorded-trade-off).

## Alternatives considered

- **TypeScript Lambda, as the plan originally specified.** Would have kept
  one language and one shared `packages/shared` contract across the whole
  repository. Not chosen because the user directing this work explicitly
  asked for C# / .NET 10.
- **Native AOT compilation** (`PublishAot`) for faster cold starts. Not used
  in this initial implementation to keep the build simple and avoid AOT's
  reflection restrictions while the API surface is still small; revisit if
  cold-start latency becomes a measured problem (see
  [`well-architected.md`](../well-architected.md#open-items-for-a-future-review)).
