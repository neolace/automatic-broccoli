using Amazon.Lambda.APIGatewayEvents;
using App.Api.Auth;
using App.Api.Errors;
using Xunit;

namespace App.Api.Tests.Auth;

public class ClaimsExtractorTests
{
    private static APIGatewayHttpApiV2ProxyRequest RequestWithClaims(IDictionary<string, string>? claims) =>
        new()
        {
            RequestContext = new APIGatewayHttpApiV2ProxyRequest.ProxyRequestContext
            {
                Authorizer = claims is null
                    ? null
                    : new APIGatewayHttpApiV2ProxyRequest.AuthorizerDescription
                    {
                        Jwt = new APIGatewayHttpApiV2ProxyRequest.AuthorizerDescription.JwtDescription
                        {
                            Claims = claims,
                        },
                    },
            },
        };

    [Fact]
    public void Extract_throws_unauthorized_when_authorizer_claims_are_missing()
    {
        var request = RequestWithClaims(null);

        Assert.Throws<UnauthorizedException>(() => ClaimsExtractor.Extract(request));
    }

    [Fact]
    public void Extract_throws_unauthorized_when_oid_and_tid_are_missing()
    {
        var request = RequestWithClaims(new Dictionary<string, string> { ["scp"] = "access_as_user" });

        Assert.Throws<UnauthorizedException>(() => ClaimsExtractor.Extract(request));
    }

    [Fact]
    public void Extract_maps_stable_claims_into_an_auth_context()
    {
        var request = RequestWithClaims(new Dictionary<string, string>
        {
            ["oid"] = "user-123",
            ["tid"] = "tenant-456",
            ["scp"] = "access_as_user other_scope",
            ["roles"] = "admin",
            ["name"] = "Ada Lovelace",
        });

        var auth = ClaimsExtractor.Extract(request);

        Assert.Equal("user-123", auth.UserId);
        Assert.Equal("tenant-456", auth.TenantId);
        Assert.Equal(["access_as_user", "other_scope"], auth.Scopes);
        Assert.Equal(["admin"], auth.Roles);
        Assert.Equal("Ada Lovelace", auth.DisplayName);
    }

    [Fact]
    public void Extract_falls_back_to_sub_when_oid_is_absent()
    {
        var request = RequestWithClaims(new Dictionary<string, string>
        {
            ["sub"] = "user-789",
            ["tid"] = "tenant-456",
        });

        var auth = ClaimsExtractor.Extract(request);

        Assert.Equal("user-789", auth.UserId);
    }
}
