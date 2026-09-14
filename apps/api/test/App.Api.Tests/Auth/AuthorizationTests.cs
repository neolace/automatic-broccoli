using App.Api.Auth;
using App.Api.Errors;
using Xunit;

namespace App.Api.Tests.Auth;

public class AuthorizationTests
{
    private static AuthContext BuildAuth(IReadOnlyList<string>? scopes = null, IReadOnlyList<string>? roles = null, string userId = "user-1") =>
        new(userId, "tenant-1", scopes ?? [], roles ?? [], "Display Name");

    [Fact]
    public void RequireScope_throws_forbidden_when_scope_is_missing()
    {
        var auth = BuildAuth(scopes: ["other_scope"]);

        Assert.Throws<ForbiddenException>(() => Authorization.RequireScope(auth, "access_as_user"));
    }

    [Fact]
    public void RequireScope_succeeds_when_scope_is_present()
    {
        var auth = BuildAuth(scopes: ["access_as_user"]);

        Authorization.RequireScope(auth, "access_as_user");
    }

    [Fact]
    public void RequireRole_throws_forbidden_when_role_is_missing()
    {
        var auth = BuildAuth(roles: ["viewer"]);

        Assert.Throws<ForbiddenException>(() => Authorization.RequireRole(auth, "admin"));
    }

    [Fact]
    public void RequireOwnership_throws_forbidden_for_a_different_owner()
    {
        var auth = BuildAuth(userId: "user-1");

        Assert.Throws<ForbiddenException>(() => Authorization.RequireOwnership(auth, "user-2"));
    }

    [Fact]
    public void RequireOwnership_succeeds_for_the_owning_user()
    {
        var auth = BuildAuth(userId: "user-1");

        Authorization.RequireOwnership(auth, "user-1");
    }
}
