using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using App.Api.Auth;
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
            // Defense in depth: API Gateway already requires this scope on the
            // route; re-check in-process so a misconfigured authorizer cannot
            // silently widen access -- see docs/authorization.md.
            Authorization.RequireScope(auth, "access_as_user");

            logger.Info("Resolved authenticated identity.");
            return Task.FromResult(HttpResponses.Json(200,
                new MeResponse(auth.UserId, auth.TenantId, auth.Scopes, auth.Roles, auth.DisplayName)));
        });
}
