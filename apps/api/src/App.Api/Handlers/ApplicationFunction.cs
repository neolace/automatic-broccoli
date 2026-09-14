using System.Text.Json;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using App.Api.Auth;
using App.Api.Errors;
using App.Api.Models;
using App.Api.Repositories;
using App.Api.Services;
using App.Api.Utils;

namespace App.Api.Handlers;

/// <summary>
/// Thin adapter for the application resource: parses the event, delegates to
/// <see cref="ApplicationService"/>, and translates the result into an HTTP
/// response. Business rules live in the service, not here.
///
/// The repository is created once per execution environment and reused
/// across warm invocations for efficiency; it holds no per-user request
/// state between invocations (see docs/lambda.md - "Lambda Security").
/// </summary>
public sealed class ApplicationFunction
{
    private static readonly IApplicationRepository Repository = new InMemoryApplicationRepository();
    private static readonly ApplicationService Service = new(Repository);

    private static readonly JsonSerializerOptions RequestSerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public async Task<APIGatewayHttpApiV2ProxyResponse> FunctionHandler(
        APIGatewayHttpApiV2ProxyRequest request,
        ILambdaContext context)
    {
        var method = request.RequestContext?.Http?.Method ?? "GET";
        var correlationId = CorrelationId.Resolve(request.Headers);
        var logger = Logger.Create(
            service: "api",
            environment: Environment.GetEnvironmentVariable("ENVIRONMENT_NAME") ?? "development",
            awsRequestId: context.AwsRequestId,
            correlationId: correlationId,
            route: "/api/applications",
            method: method);

        try
        {
            var auth = ClaimsExtractor.Extract(request);
            logger = logger.Child(new Dictionary<string, object?>
            {
                ["userOid"] = auth.UserId,
                ["tenantId"] = auth.TenantId,
            });

            return method.ToUpperInvariant() switch
            {
                "POST" => await HandleCreateAsync(request, auth, logger),
                "GET" => await HandleListAsync(auth, logger),
                _ => HttpResponses.Json(405, new { error = new { code = "METHOD_NOT_ALLOWED", message = "Unsupported method.", correlationId } }),
            };
        }
        catch (Exception ex)
        {
            return HttpResponses.FromException(ex, correlationId, logger);
        }
    }

    private static async Task<APIGatewayHttpApiV2ProxyResponse> HandleCreateAsync(
        APIGatewayHttpApiV2ProxyRequest request,
        AuthContext auth,
        Logger logger)
    {
        var createRequest = DeserializeBody(request.Body);
        var record = await Service.CreateAsync(auth, createRequest);
        logger.Info("Created application.", new Dictionary<string, object?> { ["applicationId"] = record.Id });
        return HttpResponses.Json(201, record);
    }

    private static async Task<APIGatewayHttpApiV2ProxyResponse> HandleListAsync(AuthContext auth, Logger logger)
    {
        var items = await Service.ListForCurrentUserAsync(auth);
        logger.Info("Listed applications.", new Dictionary<string, object?> { ["count"] = items.Count });
        return HttpResponses.Json(200, new ListApplicationsResponse(items));
    }

    private static CreateApplicationRequest DeserializeBody(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            throw new ValidationException("A JSON request body is required.");
        }

        try
        {
            return JsonSerializer.Deserialize<CreateApplicationRequest>(body, RequestSerializerOptions)
                ?? throw new ValidationException("A JSON request body is required.");
        }
        catch (JsonException)
        {
            throw new ValidationException("The request body is not valid JSON.");
        }
    }
}
