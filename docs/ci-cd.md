# CI/CD

## Description

The pipeline is both a delivery mechanism and a security control. Every pull
request must pass the same non-mutating checks a developer runs locally
(`npm run validate`); nothing is auto-fixed in CI. Deployment is a separate,
manually-triggered, environment-gated workflow that authenticates to AWS
with short-lived federated credentials — never long-lived AWS access keys.

## `ci.yml` — quality gates

Runs on every pull request and on pushes to `main`
([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)):

```text
checkout
  -> npm ci
  -> format:check   (Prettier + dotnet format --verify-no-changes)
  -> lint            (ESLint)
  -> typecheck       (tsc, every TS workspace)
  -> test            (Vitest: shared/web/infra  +  dotnet test: apps/api)
  -> build           (Vite build, tsc build for shared, dotnet build)
  -> cdk synth
  -> dependency review (pull requests only)
  -> Playwright smoke tests (needs: quality)
```

This mirrors `npm run validate` exactly, so "it passed on my machine" and
"it passed in CI" mean the same thing — see [testing.md](testing.md).

## `deploy.yml` — deployment

Manually triggered (`workflow_dispatch`) with an environment choice
(`dev`/`test`/`prod`), gated by a GitHub Environment of the same name so
`prod` can require manual approval and reviewers, independent of this
workflow file. See [deployment.md](deployment.md) for the required
variables and the AWS OIDC role setup.

```text
checkout
  -> npm run validate                     (repeat the quality gates)
  -> configure-aws-credentials (OIDC)      no long-lived AWS keys anywhere
  -> cdk deploy --all --context environment=<env>
  -> vite build (with the target environment's public config)
  -> aws s3 sync dist/ -> site bucket
  -> aws cloudfront create-invalidation
  -> smoke test: GET <api>/health
  -> smoke test: GET <site url>
```

A deployment is not considered complete when `cdk deploy` returns success —
the two smoke-test steps and CloudWatch alarms (see
[observability.md](observability.md)) confirm the frontend loads and the API
responds before the run is marked green.

## Artifacts

The frontend is rebuilt once per deploy run rather than promoted as an
immutable artifact across environments, because its public configuration
(`VITE_API_BASE_URL`, etc.) is environment-specific by design (see
[environment configuration](../apps/web/.env.example)). If a
build-once/promote-everywhere model is later required, inject environment
config at runtime (e.g. a small `config.json` fetched before the app boots)
rather than at build time.

## Extending this pipeline

Before enabling automatic deployment on push, add: branch protection
requiring `CI` to pass, required reviewers on the `prod` GitHub Environment,
and a rollback procedure (documented, and ideally a `cdk deploy` to the
previous commit rather than a manual console change) — see
[troubleshooting.md](troubleshooting.md).
