using System.Text.Json;
using System.Text.Json.Serialization;

namespace App.Api.Utils;

/// <summary>
/// Emits CloudWatch Embedded Metric Format (EMF) log lines so Lambda
/// automatically publishes custom metrics without a CloudWatch SDK call.
/// Each <see cref="Emit"/> call writes a single JSON line that CloudWatch
/// Logs parses into metric data points.
///
/// See: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html
/// </summary>
public static class Metrics
{
    private static readonly string ServiceName =
        Environment.GetEnvironmentVariable("SERVICE_NAME") ?? "api";

    private static readonly string EnvironmentName =
        Environment.GetEnvironmentVariable("ENVIRONMENT_NAME") ?? "development";

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>
    /// Emits a single EMF metric line to stdout for CloudWatch ingestion.
    /// </summary>
    public static void Emit(
        string metricName,
        double value,
        string unit,
        string route,
        string method,
        int? statusCode = null)
    {
        var dimensions = new Dictionary<string, string>
        {
            ["Service"] = ServiceName,
            ["Environment"] = EnvironmentName,
            ["Route"] = route,
            ["Method"] = method,
        };

        if (statusCode.HasValue)
        {
            dimensions["StatusCode"] = statusCode.Value.ToString();
        }

        var emfLine = new Dictionary<string, object>
        {
            ["_aws"] = new EmfMetadata(
                Timestamp: DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                CloudWatchMetrics:
                [
                    new EmfMetricDirective(
                        Namespace: "App/Api",
                        Dimensions: [dimensions.Keys.ToList()],
                        Metrics: [new EmfMetricDefinition(metricName, unit)])
                ]),
            [metricName] = value,
        };

        foreach (var (key, val) in dimensions)
        {
            emfLine[key] = val;
        }

        Console.WriteLine(JsonSerializer.Serialize(emfLine, SerializerOptions));
    }

    private sealed record EmfMetadata(
        long Timestamp,
        List<EmfMetricDirective> CloudWatchMetrics);

    private sealed record EmfMetricDirective(
        string Namespace,
        List<List<string>> Dimensions,
        List<EmfMetricDefinition> Metrics);

    private sealed record EmfMetricDefinition(string Name, string Unit);
}
