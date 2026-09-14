# Troubleshooting

## Sign-in redirects but the app never becomes authenticated

Check, in order:

1. Is the current origin registered as a redirect URI on the Entra app
   registration? (`http://localhost:5173` for local dev — see
   [entra-configuration.md](entra-configuration.md#redirect-uris).)
2. Does `apps/web/.env` have all four required `VITE_*` values? A missing
   one throws `EnvironmentError` at startup
   ([`environment.ts`](../apps/web/src/config/environment.ts)) with the
   exact missing key(s) named in the message.
3. Open the browser console: MSAL logs warnings/errors there in development
   mode (`piiLoggingEnabled` is always `false`, so no token content leaks —
   see [`auth-config.ts`](../apps/web/src/auth/auth-config.ts)).

## `401` from `/api/me` or `/api/applications` with a token that looks valid

The JWT authorizer rejects a token before Lambda runs on any mismatch of:

```text
iss   must equal https://login.microsoftonline.com/<TENANT_ID>/v2.0
aud   must equal <CLIENT_ID>              (see entra-configuration.md)
scp   must include access_as_user
exp   must not have passed
```

Decode the token (e.g. at jwt.ms) and compare its `iss`/`aud`/`scp` against
`ENTRA_TENANT_ID`/`ENTRA_CLIENT_ID` used at deploy time
(`infra/lib/api-stack.ts`'s `HttpJwtAuthorizer`). A mismatch almost always
means the deployed API stack and the running frontend point at different
tenants/clients, or the registration is not yet issuing v2 tokens — see
[entra-configuration.md](entra-configuration.md#expose-the-api).

## `403` from a protected route with a valid, correctly-scoped token

This means API Gateway admitted the request and Lambda's business
authorization denied it — check the specific `ApiException` message and
`code` in the response body (`FORBIDDEN`), and see
[authorization.md](authorization.md) for what
`RequireScope`/`RequireRole`/`RequireOwnership` each check.

## `cdk synth`/`cdk deploy` fails with a message about `ENTRA_TENANT_ID`/`ENTRA_CLIENT_ID`

Expected behavior, not a bug — see
[`loadEntraConfig`](../infra/lib/config/environments.ts). Export both
variables before running any CDK command; see
[deployment.md](deployment.md#deploying-infrastructure).

## `cdk synth` bundles the Lambda every time and it's slow

Each CDK synth/test run currently invokes `dotnet publish` fresh (no
bundling cache is wired up for the `local.tryBundle` path — see
[infrastructure.md](infrastructure.md#packaging-the-c-lambda)). This costs a
few seconds per run; it is a known, accepted trade-off for this reference
implementation rather than a defect. If this becomes painful, look at
memoizing the built asset across stack instantiations within one CDK app
run, or configuring `dotnet`'s own incremental build output caching.

## A CDK infra test fails after changing `api-stack.ts` or `frontend-stack.ts`

The infra test suite pins exact CloudFormation shapes (issuer/audience
strings, route auth type, IAM policy count, log retention values, response
header policy content — see [testing.md](testing.md)). A failure here after
an intentional infrastructure change is expected: update the corresponding
assertion in `infra/test/*.test.ts` in the same change, and explain why in
the PR description — this is the mechanism that prevents an accidental
security regression from merging silently (see
[security.md](security.md#iam)).

## Playwright's `authenticated` project is always skipped

By design — it requires `E2E_STORAGE_STATE` (a captured session from a real,
controlled test identity) and `E2E_BASE_URL` (a deployed environment). See
[testing.md](testing.md#end-to-end-appswebe2e-playwright).

## `npm run format:check` fails only in CI, not locally

`format:check` runs both `prettier --check .` and
`dotnet format apps/api/App.Api.sln --verify-no-changes`. The pre-commit
hook (`.husky/pre-commit` → `lint-staged`) runs `dotnet format` on staged
`.cs` files too, so this should be rare; if it happens anyway (e.g. the
commit was made with `--no-verify`), run `npm run format:api` and commit the
result.
