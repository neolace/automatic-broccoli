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
    public APIGatewayHttpApiV2ProxyResponse FunctionHandler(
        APIGatewayHttpApiV2ProxyRequest request,
        ILambdaContext context)
    {
        var correlationId = CorrelationId.Resolve(request.Headers);
        var logger = Logger.Create(
            service: "api",
            environment: Environment.GetEnvironmentVariable("ENVIRONMENT_NAME") ?? "development",
            awsRequestId: context.AwsRequestId,
            correlationId: correlationId,
            route: "GET /api/me",
            method: "GET");

        try
        {
            var auth = ClaimsExtractor.Extract(request);
            logger = logger.Child(new Dictionary<string, object?>
            {
                ["userOid"] = auth.UserId,
                ["tenantId"] = auth.TenantId,
            });
            logger.Info("Resolved authenticated identity.");

            var response = new MeResponse(auth.UserId, auth.TenantId, auth.Scopes, auth.Roles, auth.DisplayName);
            return HttpResponses.Json(200, response);
        }
        catch (Exception ex)
        {
            return HttpResponses.FromException(ex, correlationId, logger);
        }
    }
}
