# Deployment

## Prerequisites

```text
Node.js >= 24
.NET SDK 10.0.x           (dotnet --version)
AWS account + credentials with rights to create the resources below
An Entra app registration -- see entra-configuration.md
```

Docker is **not** required on a machine with the .NET 10 SDK installed:
[`infra/lib/api-lambda-bundling.ts`](../infra/lib/api-lambda-bundling.ts)
builds the Lambda locally with `dotnet publish` when the SDK is on `PATH`,
and only falls back to the `public.ecr.aws/sam/build-dotnet10` Docker image
otherwise (e.g. a CI runner without the SDK preinstalled).

```bash
npm install
```

## Local development

```bash
cp apps/web/.env.example apps/web/.env
# fill in VITE_ENTRA_TENANT_ID, VITE_ENTRA_CLIENT_ID, VITE_ENTRA_API_SCOPE,
# VITE_API_BASE_URL -- see entra-configuration.md

npm run dev --workspace apps/web       # http://localhost:5173
dotnet test apps/api/App.Api.sln       # or: npm run test:api
```

`http://localhost:5173` must already be registered as a redirect URI on the
Entra app registration (it is, in the example configuration — see
[entra-configuration.md](entra-configuration.md#redirect-uris)).

## Deploying infrastructure

Every `synth`/`deploy` requires the two non-secret Entra identifiers as
environment variables:

```bash
export ENTRA_TENANT_ID=<tenant id>
export ENTRA_CLIENT_ID=<client id>

npm run synth --workspace infra                              # dev, by default
npx cdk deploy --all --context environment=prod              # from infra/, or:
npm run deploy --workspace infra -- --all --context environment=prod
```

`infra/lib/config/environments.ts` throws a clear, actionable error rather
than silently deploying with a placeholder tenant/client id if either
variable is missing.

### First deploy in an AWS account

`cdk bootstrap` must have been run once per account/region
(`npx cdk bootstrap aws://<ACCOUNT_ID>/<REGION>`, from `infra/`) before the
first `cdk deploy`.

### Adding a custom domain

By default every environment serves the frontend and the API from their
generated `*.execute-api.*.amazonaws.com` domains — no domain or ACM
certificate is required to deploy. To add real domains for an environment,
uncomment and fill in the `domain` block for that environment in
[`infra/lib/config/environments.ts`](../infra/lib/config/environments.ts):

```ts
domain: {
  hostedZoneName: 'example.com',
  siteDomainName: 'app.example.com',
  apiDomainName: 'api.example.com',
},
```

Both `siteDomainName` and `apiDomainName` are wired the same way: regional
ACM certificate (DNS-validated against the hosted zone), API Gateway HTTP
API custom domain mapping, and a Route 53 alias A-record. Unlike CloudFront,
these take a **regional** ACM certificate — issued in the same region the
stack deploys to, not necessarily `us-east-1` — see
[`adr/0003-remove-cloudfront.md`](adr/0003-remove-cloudfront.md).

When `domain` is set, `resolveCorsOrigins` also allows
`https://<siteDomainName>` on the API, and the site Lambda's CSP
`connect-src` includes `https://<apiDomainName>`.

## Deploying the frontend

`cdk deploy` provisions the bucket, the site Lambda and the HTTP API but
does not itself publish the compiled frontend. After a successful
`cdk deploy`:

```bash
npm run build --workspace apps/web
aws s3 sync apps/web/dist s3://<SiteBucketName output> --delete
```

There is no CDN cache to invalidate — every request is served live by the
site Lambda. `SiteBucketName` is printed as a CloudFormation output of the
`<env>-app-frontend` stack. `.github/workflows/deploy.yml` automates this
step for CI-driven deploys — see
[ci-cd.md](ci-cd.md#deployyml--deployment).

## Configuring CI/CD deployment

`deploy.yml` expects these to be set on the target GitHub Environment
(`dev`/`test`/`prod`), as repository or environment **variables** (all
non-secret) unless noted:

```text
AWS_DEPLOY_ROLE_ARN        IAM role ARN with an OIDC trust policy scoped to
                           this repo + environment (see below)
AWS_REGION
ENTRA_TENANT_ID
ENTRA_CLIENT_ID
```

`ApiUrl`, `SiteBucketName` and `SiteUrl` are **not** pre-seeded. After
`cdk deploy --outputs-file`, the workflow reads those CloudFormation outputs
and feeds them into the frontend build (`VITE_API_BASE_URL`), `aws s3 sync`,
and the smoke-test curls.

### Creating the OIDC deploy role

Use workload identity federation (GitHub's OIDC provider), not a long-lived
AWS access key — see [security.md](security.md). Outline:

1. Add GitHub's OIDC provider to the AWS account (`token.actions.githubusercontent.com`), once per account.
2. Create an IAM role whose trust policy's `sub` condition is scoped to this repository and, ideally, the specific GitHub Environment (`repo:<org>/<repo>:environment:<env>`).
3. Attach only the permissions this pipeline needs: `cloudformation:*` on the three stacks, `s3:*` on the site bucket, plus whatever the CDK bootstrap role model requires for asset publishing in this account.
4. Record the role ARN as `AWS_DEPLOY_ROLE_ARN`.

## Rollback

Prefer redeploying a previous known-good commit
(`npx cdk deploy --all --context environment=<env>` from that commit) over a
manual console change, so infrastructure state and version control never
diverge — see [troubleshooting.md](troubleshooting.md).
