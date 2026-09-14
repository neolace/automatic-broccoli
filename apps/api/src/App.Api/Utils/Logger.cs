using System.Text.Json;

namespace App.Api.Utils;

/// <summary>
/// Minimal structured JSON logger for CloudWatch Logs Insights.
///
/// Every log line is a single JSON object so fields can be filtered and
/// aggregated reliably. Tokens, authorization headers, secrets and cookies
/// must never be passed as fields -- see docs/observability.md. Field keys
/// are checked against a denylist and redacted defensively.
/// </summary>
public sealed class Logger
{
    private static readonly HashSet<string> DenylistedFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "token", "accesstoken", "idtoken", "authorization", "password", "secret", "cookie",
    };

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly IReadOnlyDictionary<string, object?> _context;

    private Logger(IReadOnlyDictionary<string, object?> context)
    {
        _context = context;
    }

    public static Logger Create(
        string service,
        string environment,
        string? awsRequestId = null,
        string? correlationId = null,
        string? route = null,
        string? method = null) =>
        new(new Dictionary<string, object?>
        {
            ["service"] = service,
            ["environment"] = environment,
            ["awsRequestId"] = awsRequestId,
            ["correlationId"] = correlationId,
            ["route"] = route,
            ["method"] = method,
        });

    public Logger Child(IReadOnlyDictionary<string, object?> extra)
    {
        var merged = new Dictionary<string, object?>(_context);
        foreach (var (key, value) in extra)
        {
            merged[key] = value;
        }

        return new Logger(merged);
    }

    public void Info(string message, IReadOnlyDictionary<string, object?>? fields = null) =>
        Write("info", message, fields);

    public void Warn(string message, IReadOnlyDictionary<string, object?>? fields = null) =>
        Write("warn", message, fields);

    public void Error(string message, IReadOnlyDictionary<string, object?>? fields = null) =>
        Write("error", message, fields);

    private void Write(string level, string message, IReadOnlyDictionary<string, object?>? fields)
    {
        var entry = new Dictionary<string, object?>(_context)
        {
            ["timestamp"] = DateTimeOffset.UtcNow.ToString("O"),
            ["level"] = level,
            ["message"] = message,
        };

        if (fields is not null)
        {
            foreach (var (key, value) in fields)
            {
                entry[key] = DenylistedFields.Contains(key) ? "[redacted]" : value;
            }
        }

        Console.WriteLine(JsonSerializer.Serialize(entry, SerializerOptions));
    }
}
