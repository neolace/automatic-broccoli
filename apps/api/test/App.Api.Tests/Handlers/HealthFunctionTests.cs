using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.TestUtilities;
using App.Api.Handlers;
using Xunit;

namespace App.Api.Tests.Handlers;

public class HealthFunctionTests
{
    [Fact]
    public void FunctionHandler_returns_200_ok_without_requiring_authentication()
    {
        var function = new HealthFunction();
        var response = function.FunctionHandler(new APIGatewayHttpApiV2ProxyRequest(), new TestLambdaContext());

        Assert.Equal(200, response.StatusCode);
        Assert.Contains("\"status\":\"ok\"", response.Body);
    }
}
