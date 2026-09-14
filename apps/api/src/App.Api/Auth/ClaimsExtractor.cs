using Amazon.Lambda.APIGatewayEvents;
using App.Api.Errors;

namespace App.Api.Auth;

/// <summary>
/// Shapes the trusted claims API Gateway forwards to Lambda into an
/// <see cref="AuthContext"/>. Never re-implements JWT signature checking,
/// JWKS retrieval or expiry validation -- API Gateway owns those.
/// </summary>
public static class ClaimsExtractor
{
    public static AuthContext Extract(APIGatewayHttpApiV2ProxyRequest request)
    {
        var claims = request.RequestContext?.Authorizer?.Jwt?.Claims;
        if (claims is null)
        {
            throw new UnauthorizedException("Request is missing validated authorizer claims.");
        }

        var userId = GetString(claims, "oid") ?? GetString(claims, "sub");
        var tenantId = GetString(claims, "tid");

        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(tenantId))
        {
            throw new UnauthorizedException("Token is missing required oid/tid claims.");
        }

        return new AuthContext(
            UserId: userId,
            TenantId: tenantId,
            Scopes: GetStringArray(claims, "scp"),
            Roles: GetStringArray(claims, "roles"),
            DisplayName: GetString(claims, "name"));
    }

    private static string? GetString(IDictionary<string, string> claims, string key) =>
        claims.TryGetValue(key, out var value) && !string.IsNullOrEmpty(value) ? value : null;

    private static IReadOnlyList<string> GetStringArray(IDictionary<string, string> claims, string key)
    {
        var value = GetString(claims, key);
        if (value is null)
        {
            return [];
        }
        // API Gateway's JWT authorizer forwards multi-value claims as a space-delimited string.
        return value.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }
}
