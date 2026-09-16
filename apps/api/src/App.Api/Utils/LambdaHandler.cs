using System.Diagnostics;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using App.Api.Auth;

namespace App.Api.Utils;

/// <summary>
/// Eliminates the repeated logger-setup and error-handling boilerplate that
/// every authenticated Lambda handler needs. Callers supply only the route
/// and the business logic; this helper owns correlation, logging context,
/// claims extraction, X-Ray tracing, EMF metrics, and the top-level
/// exception fence.
/// </summary>
public static class LambdaHandler
{
    private static readonly string Environment =
        System.Environment.GetEnvironmentVariable("ENVIRONMENT_NAME") ?? "development";

    public static async Task<APIGatewayHttpApiV2ProxyResponse> ExecuteAsync(
        APIGatewayHttpApiV2ProxyRequest request,
        ILambdaContext context,
        string route,
        Func<AuthContext, Logger, LambdaRequestContext, Task<APIGatewayHttpApiV2ProxyResponse>> handler)
    {
        var method = request.RequestContext?.Http?.Method ?? "GET";
        var correlationId = CorrelationId.Resolve(request.Headers);
        var logger = Logger.Create(
            service: "api",
            environment: Environment,
            awsRequestId: context.AwsRequestId,
            correlationId: correlationId,
            route: route,
            method: method);

        var stopwatch = Stopwatch.StartNew();

        try
        {
            var response = await Tracing.TraceAsync($"Handler {route}", route, method, async () =>
            {
                var auth = ClaimsExtractor.Extract(request);
                logger = logger.Child(new Dictionary<string, object?>
                {
                    ["userOid"] = auth.UserId,
                    ["tenantId"] = auth.TenantId,
                });

                var requestContext = new LambdaRequestContext(correlationId, method);
                return await handler(auth, logger, requestContext);
            });

            stopwatch.Stop();
            Metrics.Emit("Latency", stopwatch.Elapsed.TotalMilliseconds, "Milliseconds", route, method, response.StatusCode);
            Metrics.Emit("RequestCount", 1, "Count", route, method, response.StatusCode);

            if (response.StatusCode >= 500)
            {
                Metrics.Emit("5xxError", 1, "Count", route, method, response.StatusCode);
            }
            else if (response.StatusCode >= 400)
            {
                Metrics.Emit("4xxError", 1, "Count", route, method, response.StatusCode);
            }

            return response;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            var response = HttpResponses.FromException(ex, correlationId, logger);
            Metrics.Emit("Latency", stopwatch.Elapsed.TotalMilliseconds, "Milliseconds", route, method, response.StatusCode);
            Metrics.Emit("RequestCount", 1, "Count", route, method, response.StatusCode);

            if (response.StatusCode >= 500)
            {
                Metrics.Emit("5xxError", 1, "Count", route, method, response.StatusCode);
            }
            else if (response.StatusCode >= 400)
            {
                Metrics.Emit("4xxError", 1, "Count", route, method, response.StatusCode);
            }

            return response;
        }
    }
}

/// <summary>
/// Per-invocation values resolved by <see cref="LambdaHandler"/> and passed
/// to the business-logic delegate so handlers never need to re-derive them.
/// </summary>
public sealed record LambdaRequestContext(string CorrelationId, string Method);
