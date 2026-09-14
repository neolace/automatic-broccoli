using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using App.Api.Models;
using App.Api.Utils;

namespace App.Api.Handlers;

/// <summary>
/// Unauthenticated liveness check. Returns only a fixed status and timestamp
/// -- never configuration, dependency details, or environment state.
/// </summary>
public sealed class HealthFunction
{
    public APIGatewayHttpApiV2ProxyResponse FunctionHandler(
        APIGatewayHttpApiV2ProxyRequest request,
        ILambdaContext context) =>
        HttpResponses.Json(200, new HealthResponse("ok", DateTimeOffset.UtcNow.ToString("O")));
}
