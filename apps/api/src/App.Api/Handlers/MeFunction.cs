using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using App.Api.Models;
using App.Api.Utils;

namespace App.Api.Handlers;

/// <summary>
/// Diagnostic bootstrap endpoint (GET /api/me): confirms the trust boundary
/// end to end by returning a small allow-listed identity projection. It must
/// never echo the raw token or the full claim set.
/// </summary>
public sealed class MeFunction
{
    public Task<APIGatewayHttpApiV2ProxyResponse> FunctionHandler(
        APIGatewayHttpApiV2ProxyRequest request,
        ILambdaContext context) =>
        LambdaHandler.ExecuteAsync(request, context, "/api/me", (auth, logger, _) =>
        {
            logger.Info("Resolved authenticated identity.");
            return Task.FromResult(HttpResponses.Json(200,
                new MeResponse(auth.UserId, auth.TenantId, auth.Scopes, auth.Roles, auth.DisplayName)));
        });
}
