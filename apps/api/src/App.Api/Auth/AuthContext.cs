namespace App.Api.Auth;

/// <summary>
/// Application identity derived from claims that API Gateway has already
/// cryptographically validated (signature, issuer, audience, expiry, scope).
/// This never re-verifies those checks -- see docs/authentication.md.
/// </summary>
public sealed record AuthContext(
    /// <summary>Stable user object id (`oid`). Use this for authorization, never email.</summary>
    string UserId,
    /// <summary>Tenant id (`tid`).</summary>
    string TenantId,
    /// <summary>Delegated scopes granted to the calling application (`scp`).</summary>
    IReadOnlyList<string> Scopes,
    /// <summary>Application roles assigned to the user (`roles`), if any.</summary>
    IReadOnlyList<string> Roles,
    /// <summary>Presentation only -- never use for authorization decisions.</summary>
    string? DisplayName);
