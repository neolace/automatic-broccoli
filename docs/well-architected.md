# AWS Well-Architected Review

## Description

The Well-Architected Framework is the review lens for this workload, not a
decorative checklist. For a serverless workload like this one, the pillars
interact: moving JWT validation to API Gateway (see
[security.md](security.md)) improves security by removing custom
cryptographic code, operational excellence by centralizing policy,
performance by rejecting bad requests before compute, and cost by avoiding
unnecessary Lambda invocations — one decision, four pillars.

Run a Well-Architected review before production and again after any
material architecture change; record findings as engineering work with
owners and target dates, not as a report nobody acts on.

## Pillar implementation

| Pillar                     | Implementation in this repository                                                                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Operational Excellence** | CDK IaC ([infrastructure.md](infrastructure.md)); CI runs the same checks as local `npm run validate` ([ci-cd.md](ci-cd.md)); structured JSON logs with a correlation id ([observability.md](observability.md)); this documentation set, versioned with the code.                                                                                            |
| **Security**               | Entra MFA/Conditional Access owned by Entra, not reimplemented ([security.md](security.md)); PKCE, no SPA client secret; API Gateway JWT validation before compute; scoped, claims-based Lambda authorization ([authorization.md](authorization.md)); least-privilege IAM (one managed policy per function, nothing else); private S3 behind CloudFront OAC. |
| **Reliability**            | Every compute and delivery component is an AWS managed service (Lambda, API Gateway, CloudFront, S3); CloudWatch alarms on Lambda errors/throttles/duration and API 5xx/latency ([observability.md](observability.md)); infrastructure is reproducible from source, not hand-configured.                                                                     |
| **Performance Efficiency** | CloudFront caching for static assets; HTTP API (lower latency/cost than REST API) with a native JWT authorizer instead of a Lambda authorizer; Lambda execution-environment reuse for the repository/service singletons in `ApplicationFunction` ([lambda.md](lambda.md)).                                                                                   |
| **Cost Optimization**      | Fully serverless, pay-per-use compute and API layer; S3 + CloudFront static hosting instead of always-on compute for the frontend; environment-scaled log retention (2 weeks dev, 1 month test, 6 months prod) instead of indefinite retention everywhere.                                                                                                   |
| **Sustainability**         | Managed/serverless services scale to zero when idle; no VPC, NAT gateway, or other always-on networking component exists because nothing in this workload requires one yet ([infrastructure.md](infrastructure.md#networking)).                                                                                                                              |

## Recorded trade-off

The single Entra tenant / single app registration decision is the one
deliberate departure from a "by the book" identity architecture in this
workload, and it is recorded formally as
[`adr/0001-single-entra-app-registration.md`](adr/0001-single-entra-app-registration.md),
including the concrete triggers that mean it should be revisited. A
Well-Architected review of this workload should reference that ADR rather
than re-litigate the trade-off from scratch.

The Lambda runtime language (C# rather than TypeScript) is a second
deliberate departure from the original plan and is recorded as
[`adr/0002-dotnet-lambda-runtime.md`](adr/0002-dotnet-lambda-runtime.md). It
does not affect any Well-Architected pillar differently than the TypeScript
alternative would — see that ADR's consequences section.

## Open items for a future review

- No custom domain is configured for any environment yet (CloudFront and API
  Gateway generated domains are in use) — see
  [deployment.md](deployment.md#adding-a-custom-domain).
- `deploy.yml` is manually triggered; no automatic promotion-on-merge or
  required-reviewer gate on the `prod` GitHub Environment has been
  configured outside this repository — see [ci-cd.md](ci-cd.md).
- The `apps/api` reference repository is in-memory; a real workload needs a
  persistent store before this goes to production traffic — see
  [api.md](api.md#get-apiapplications--post-apiapplications).
