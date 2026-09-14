# Lambda (C# / .NET 10)

## Description

The architecture plan calls for TypeScript "for consistency across frontend
and infrastructure." This project deviates from that one line by explicit
request: **the Lambda API is implemented in C# targeting .NET 10**, on
AWS Lambda's managed `dotnet10` runtime. Everything else in the plan —
thin handlers, no re-implemented JWT verification, least-privilege IAM,
structured JSON logging, claims-based authorization — is implemented exactly
as written, just in C#. See
[`adr/0002-dotnet-lambda-runtime.md`](adr/0002-dotnet-lambda-runtime.md) for
the full rationale and consequences.

## Project layout

```text
apps/api/
├── App.Api.sln
├── Directory.Build.props        Shared build settings (net10.0, nullable, warnings-as-errors)
├── src/App.Api/
│   ├── Handlers/                 Thin adapters: parse event -> call service -> build response
│   │   ├── HealthFunction.cs
│   │   ├── MeFunction.cs
│   │   └── ApplicationFunction.cs
│   ├── Auth/                     Claims shaping + authorization decisions (see authorization.md)
│   ├── Services/                 Business rules, independent of AWS event types
│   ├── Repositories/             Storage seam (in-memory reference implementation)
│   ├── Models/                   Wire contracts (mirrors packages/shared/src/api-contracts.ts)
│   ├── Errors/                   Typed exceptions -> HTTP status mapping
│   └── Utils/                    Structured logger, correlation id, HTTP response helpers
└── test/App.Api.Tests/           xUnit tests, one folder per src/ folder
```

Each handler is a single public method:

```csharp
public APIGatewayHttpApiV2ProxyResponse FunctionHandler(
    APIGatewayHttpApiV2ProxyRequest request, ILambdaContext context)
```

All three handlers are published from one `dotnet publish` of
`App.Api.csproj` and referenced by different
`Assembly::Namespace.Type::Method` handler strings on their own Lambda
function resource — see
[`infra/lib/api-lambda-bundling.ts`](../infra/lib/api-lambda-bundling.ts) and
[infrastructure.md](infrastructure.md#packaging-the-c-lambda).

## What Lambda never does

Per the plan, Lambda must not reimplement anything API Gateway already
guarantees:

```text
OAuth login
OIDC discovery
JWT signature checking
JWKS retrieval
Token expiry validation
```

`ClaimsExtractor.cs` only shapes already-validated claims
(`event.requestContext.authorizer.jwt.claims`, exposed by
`Amazon.Lambda.APIGatewayEvents` as
`APIGatewayHttpApiV2ProxyRequest.RequestContext.Authorizer.Jwt.Claims`) — it
never touches a signing key or an issuer metadata document. See
[authorization.md](authorization.md).

## Security posture

- **Least privilege**: each function's execution role has only the
  AWS-managed `AWSLambdaBasicExecutionRole` (CloudWatch Logs). No function
  calls another AWS service today, so no additional permission is granted —
  enforced by `infra/test/api-stack.test.ts`
  (`grants each Lambda function only the AWS-managed basic execution
policy`).
- **No cross-invocation state**: `ApplicationFunction` initializes its
  in-memory repository and service once per execution environment
  (`private static readonly` fields) for warm-start efficiency, exactly as
  the plan recommends for SDK clients — but it holds no per-user request
  state between invocations. A cold start resets the in-memory store by
  design (see [api.md](api.md#get-apiapplications--post-apiapplications)).
- **Structured logging**: `Logger.cs` writes one JSON object per line and
  redacts a denylist of field names (`token`, `authorization`, `password`,
  `cookie`, …) defensively, in addition to the convention of never passing
  those values in the first place — see [observability.md](observability.md).
- **No wildcard permissions**: nothing in this codebase grants
  `Action: "*"` / `Resource: "*"`.

## Testing

`apps/api/test/App.Api.Tests` (28 tests) covers claims extraction,
authorization rules, business validation, and each handler's HTTP-level
behavior (status codes, and specifically that a bearer token never appears
in a response body) using `Amazon.Lambda.TestUtilities.TestLambdaContext` —
no real AWS resources are involved. Run with:

```bash
npm run test:api
# or, from apps/api:
dotnet test App.Api.sln
```

See [testing.md](testing.md) for how this fits with the rest of the test
pyramid.
