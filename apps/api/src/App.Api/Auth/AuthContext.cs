namespace App.Api.Auth;

/// <summary>
/// Application identity derived from claims that API Gateway has already
/// cryptographically validated (signature, issuer, audience, expiry, scope).
/// This never re-verifies those checks -- see docs/authentication.md.
/// </summary>
public sealed record AuthContext(
    string UserId,
    string TenantId,
    IReadOnlyList<string> Scopes,
    IReadOnlyList<string> Roles,
    string? DisplayName);
