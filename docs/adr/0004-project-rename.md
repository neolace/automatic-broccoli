# ADR 0004: Project Renamed to `gm-prime-equities-auth`

## Status

Accepted.

## Context

The repository's root `package.json` `name` field was `entra-react-aws-lambda`
— a description of the tech stack, not a product name. The user directing
this work asked for it to be renamed to `gm-prime-equities-auth`, tying the
package identity to the actual product/business it belongs to rather than
its implementation stack.

## Decision

`package.json`'s root `name` field is `gm-prime-equities-auth`.
`package-lock.json` was regenerated (`npm install`) so its root package name
and the workspace root entry match. No other file in the repository referred
to the old name (`docs/architecture.md` and the other documentation
reference the project by what it does, not by this field).

## Consequences

- **Cosmetic only.** This field is not published (`"private": true`), not
  read by any CDK stack, CI workflow, or application code — grepping the
  repository for the old name after the change confirmed no other reference
  existed. Nothing else needed to change.
- **CDK stack and resource names are unaffected.** These are already derived
  from `infra/lib/config/environments.ts`'s `appEnv.name` (`dev`/`test`/`prod`)
  and a fixed `app` prefix (`${appEnv.name}-app-...`), not from the root
  `package.json` name — see [`infrastructure.md`](../infrastructure.md).

## Alternatives considered

- **Leave it as `entra-react-aws-lambda`.** Rejected — the user explicitly
  asked for the rename so the package identity reflects the product/business
  it serves.
