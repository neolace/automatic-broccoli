using System.Text.RegularExpressions;

namespace App.Api.Utils;

/// <summary>
/// Resolves the request correlation id used to trace a call end to end.
///
/// A client-supplied id is accepted only when it is short and made of safe
/// characters, so it cannot be used to inject content into logs; otherwise a
/// new id is minted. This mirrors packages/shared/src/correlation.ts on the
/// frontend so both sides agree on what a valid id looks like.
/// </summary>
public static partial class CorrelationId
{
    public const string HeaderName = "x-correlation-id";

    [GeneratedRegex("^[A-Za-z0-9._:-]{8,128}$")]
    private static partial Regex Pattern();

    public static bool IsValid(string? value) => value is not null && Pattern().IsMatch(value);

    public static string Resolve(IDictionary<string, string>? headers)
    {
        var candidate = FindHeader(headers, HeaderName);
        return IsValid(candidate) ? candidate! : Guid.NewGuid().ToString();
    }

    private static string? FindHeader(IDictionary<string, string>? headers, string name)
    {
        if (headers is null)
        {
            return null;
        }

        foreach (var (key, value) in headers)
        {
            if (string.Equals(key, name, StringComparison.OrdinalIgnoreCase))
            {
                return value;
            }
        }

        return null;
    }
}
