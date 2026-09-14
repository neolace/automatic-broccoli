using System.Text.Json;
using Amazon.Lambda.APIGatewayEvents;
using App.Api.Errors;
using App.Api.Models;

namespace App.Api.Utils;

public static class HttpResponses
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    private static readonly IDictionary<string, string> SecurityHeaders = new Dictionary<string, string>
    {
        ["Content-Type"] = "application/json",
        ["X-Content-Type-Options"] = "nosniff",
        ["Cache-Control"] = "no-store",
    };

    public static APIGatewayHttpApiV2ProxyResponse Json(int statusCode, object body) =>
        new()
        {
            StatusCode = statusCode,
            Headers = SecurityHeaders,
            Body = JsonSerializer.Serialize(body, SerializerOptions),
        };

    /// <summary>
    /// Converts a thrown exception into an HTTP response. Known ApiException
    /// instances map to their declared status and code; anything else becomes
    /// a generic 500 so internal details are never leaked to the caller.
    /// </summary>
    public static APIGatewayHttpApiV2ProxyResponse FromException(Exception exception, string correlationId, Logger logger)
    {
        if (exception is ApiException apiException)
        {
            if (apiException.StatusCode >= 500)
            {
                logger.Error(apiException.Message, new Dictionary<string, object?> { ["code"] = apiException.Code });
            }
            else
            {
                logger.Warn(apiException.Message, new Dictionary<string, object?> { ["code"] = apiException.Code });
            }

            return Json(apiException.StatusCode, new ApiErrorBody(new ApiErrorDetail(
                apiException.Code,
                apiException.Message,
                correlationId,
                apiException.Details)));
        }

        logger.Error("Unhandled error", new Dictionary<string, object?> { ["errorMessage"] = exception.Message });

        return Json(500, new ApiErrorBody(new ApiErrorDetail(
            "INTERNAL_ERROR",
            "An unexpected error occurred.",
            correlationId,
            null)));
    }
}
