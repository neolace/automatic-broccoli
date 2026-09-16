using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.TestUtilities;
using App.Api.Handlers;
using Xunit;

namespace App.Api.Tests.Handlers;

public class MeFunctionTests
{
    private static APIGatewayHttpApiV2ProxyRequest RequestWithClaims(IDictionary<string, string>? claims) =>
        new()
        {
            Headers = new Dictionary<string, string>(),
            RequestContext = new APIGatewayHttpApiV2ProxyRequest.ProxyRequestContext
            {
                Authorizer = claims is null
                    ? null
                    : new APIGatewayHttpApiV2ProxyRequest.AuthorizerDescription
                    {
                        Jwt = new APIGatewayHttpApiV2ProxyRequest.AuthorizerDescription.JwtDescription { Claims = claims },
                    },
            },
        };

    [Fact]
    public async Task FunctionHandler_returns_401_when_claims_are_missing()
    {
        var function = new MeFunction();
        var response = await function.FunctionHandler(RequestWithClaims(null), new TestLambdaContext());

        Assert.Equal(401, response.StatusCode);
        Assert.Contains("UNAUTHORIZED", response.Body);
    }

    [Fact]
    public async Task FunctionHandler_never_echoes_a_bearer_token_and_returns_only_allow_listed_fields()
    {
        var request = RequestWithClaims(new Dictionary<string, string>
        {
            ["oid"] = "user-123",
            ["tid"] = "tenant-456",
            ["scp"] = "access_as_user",
        });
        request.Headers["Authorization"] = "Bearer super-secret-token-value";

        var function = new MeFunction();
        var response = await function.FunctionHandler(request, new TestLambdaContext());

        Assert.Equal(200, response.StatusCode);
        Assert.Contains("user-123", response.Body);
        Assert.DoesNotContain("super-secret-token-value", response.Body);
    }
}
