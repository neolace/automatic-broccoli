# Entra ID + React/Vite + AWS Lambda Reference Architecture

A secure single-page application that uses Microsoft Entra ID for identity
and AWS serverless services for hosting, API exposure, compute, monitoring
and deployment — no Amazon Cognito, no AWS Amplify, no client secret in the
browser.

```text
React 19 + Vite + TypeScript  --MSAL.js, PKCE-->  Microsoft Entra ID
                                                          |
                                              v2 access token (single tenant,
                                              single app registration)
                                                          |
                                                          v
                              API Gateway HTTP API  --JWT authorizer-->  AWS Lambda (C# / .NET 10)
                                                                              |
                                                                    oid / roles / ownership
                                                                              |
                                                                              v
                                                                    Application services
```

Full design rationale lives in
[`Microsoft Entra ID + React Vite + AWS Lambda Architecture Plan.md`](<Microsoft Entra ID + React Vite + AWS Lambda Architecture Plan.md>)
at the repository root. This implementation follows that plan with one
explicit, documented deviation — the Lambda API is C# on .NET 10, not
TypeScript — see [`docs/adr/0002-dotnet-lambda-runtime.md`](docs/adr/0002-dotnet-lambda-runtime.md).

## Repository layout

```text
apps/web/     React + Vite + TypeScript SPA (MSAL.js)
apps/api/     C# (.NET 10) Lambda handlers -- App.Api.sln
packages/shared/  TypeScript types/constants shared by apps/web and infra
infra/        AWS CDK v2 (TypeScript): frontend, api, observability stacks
docs/         Architecture, security, deployment and operations documentation
.github/workflows/  CI (quality gates) and deploy (environment-gated) pipelines
```

## Prerequisites

```text
Node.js >= 22
.NET SDK 10.0.x
An AWS account (for deployment)
A Microsoft Entra app registration (see docs/entra-configuration.md)
```

## Quickstart

```bash
npm install

cp apps/web/.env.example apps/web/.env
# fill in VITE_ENTRA_TENANT_ID, VITE_ENTRA_CLIENT_ID, VITE_ENTRA_API_SCOPE,
# VITE_API_BASE_URL -- see docs/entra-configuration.md

npm run dev --workspace apps/web   # http://localhost:5173
```

```bash
npm run validate   # format:check, lint, typecheck, test, build (TS + C#)
```

## Documentation

| Document                                                   | Covers                                                |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)               | System overview, request paths, stacks                |
| [docs/entra-configuration.md](docs/entra-configuration.md) | Creating and configuring the Entra app registration   |
| [docs/authentication.md](docs/authentication.md)           | MSAL sign-in flow and states                          |
| [docs/authorization.md](docs/authorization.md)             | Claims, scopes, and business authorization rules      |
| [docs/api.md](docs/api.md)                                 | Routes, contracts, error shape                        |
| [docs/lambda.md](docs/lambda.md)                           | C# Lambda project structure and security posture      |
| [docs/infrastructure.md](docs/infrastructure.md)           | CDK stacks: frontend, API, observability              |
| [docs/security.md](docs/security.md)                       | The three trust boundaries and how they stay separate |
| [docs/observability.md](docs/observability.md)             | Logging, correlation IDs, alarms, dashboard           |
| [docs/testing.md](docs/testing.md)                         | The test pyramid: unit, component, infra, e2e         |
| [docs/ci-cd.md](docs/ci-cd.md)                             | The CI and deploy pipelines                           |
| [docs/deployment.md](docs/deployment.md)                   | How to deploy each environment                        |
| [docs/troubleshooting.md](docs/troubleshooting.md)         | Common issues and how to diagnose them                |
| [docs/well-architected.md](docs/well-architected.md)       | Well-Architected pillar mapping                       |
| [docs/adr/](docs/adr/)                                     | Recorded architecture decisions and their trade-offs  |

## Definition of done

See the plan's [Definition of Done](<Microsoft Entra ID + React Vite + AWS Lambda Architecture Plan.md#29-definition-of-done>)
section for the full release gate. As of this implementation: 48 frontend/
shared/infra tests and 28 API tests pass, `npm run validate` is clean, and
`npx cdk synth` produces zero warnings.
