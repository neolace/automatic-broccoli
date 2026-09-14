using App.Api.Errors;

namespace App.Api.Auth;

/// <summary>
/// Business/application authorization decisions made from validated claims.
/// A valid, correctly scoped token is necessary but not sufficient: these
/// helpers answer "can this identity perform this operation" -- see
/// docs/authorization.md.
/// </summary>
public static class Authorization
{
    public static void RequireScope(AuthContext auth, string scope)
    {
        if (!auth.Scopes.Contains(scope, StringComparer.Ordinal))
        {
            throw new ForbiddenException($"The '{scope}' scope is required for this operation.");
        }
    }

    public static void RequireRole(AuthContext auth, string role)
    {
        if (!auth.Roles.Contains(role, StringComparer.Ordinal))
        {
            throw new ForbiddenException($"The '{role}' role is required for this operation.");
        }
    }

    /// <summary>Throws unless the authenticated user (`oid`) owns the resource.</summary>
    public static void RequireOwnership(AuthContext auth, string resourceOwnerId)
    {
        if (!string.Equals(auth.UserId, resourceOwnerId, StringComparison.Ordinal))
        {
            throw new ForbiddenException("You do not own this resource.");
        }
    }
}
