using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.TestUtilities;
using App.Api.Handlers;
using Xunit;

namespace App.Api.Tests.Handlers;

public class ApplicationFunctionTests
{
    private static APIGatewayHttpApiV2ProxyRequest BuildRequest(string method, string? body = null) =>
        new()
        {
            Headers = new Dictionary<string, string>(),
            Body = body,
            RequestContext = new APIGatewayHttpApiV2ProxyRequest.ProxyRequestContext
            {
                Http = new APIGatewayHttpApiV2ProxyRequest.HttpDescription { Method = method },
                Authorizer = new APIGatewayHttpApiV2ProxyRequest.AuthorizerDescription
                {
                    Jwt = new APIGatewayHttpApiV2ProxyRequest.AuthorizerDescription.JwtDescription
                    {
                        Claims = new Dictionary<string, string>
                        {
                            ["oid"] = "user-123",
                            ["tid"] = "tenant-456",
                            ["scp"] = "access_as_user",
                        },
                    },
                },
            },
        };

    [Fact]
    public async Task FunctionHandler_rejects_an_invalid_create_request_with_400()
    {
        var function = new ApplicationFunction();
        var response = await function.FunctionHandler(BuildRequest("POST", "{}"), new TestLambdaContext());

        Assert.Equal(400, response.StatusCode);
        Assert.Contains("VALIDATION_ERROR", response.Body);
    }

    [Fact]
    public async Task FunctionHandler_creates_and_then_lists_the_application()
    {
        var function = new ApplicationFunction();

        var createResponse = await function.FunctionHandler(
            BuildRequest("POST", "{\"name\":\"My App\"}"),
            new TestLambdaContext());
        Assert.Equal(201, createResponse.StatusCode);

        var listResponse = await function.FunctionHandler(BuildRequest("GET"), new TestLambdaContext());
        Assert.Equal(200, listResponse.StatusCode);
        Assert.Contains("My App", listResponse.Body);
    }

    [Fact]
    public async Task FunctionHandler_returns_405_for_an_unsupported_method()
    {
        var function = new ApplicationFunction();
        var response = await function.FunctionHandler(BuildRequest("DELETE"), new TestLambdaContext());

        Assert.Equal(405, response.StatusCode);
    }
}
